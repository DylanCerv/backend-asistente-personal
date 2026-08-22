const { getServiceClient } = require("../clients/supabase.client");

const SELECT_COLS = `
  id,
  user_id,
  record_id,
  schedule_key,
  trigger_at,
  title,
  body,
  alert_level,
  kind,
  payload,
  status,
  sent_at,
  error,
  created_at,
  updated_at
`;

const UPSERT_BATCH_SIZE = 100;
const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 400;

function truncate(value, max) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

class ScheduledNotificationRepository {
  constructor(client = null) {
    this.client = client;
  }

  getClient() {
    if (!this.client) this.client = getServiceClient();
    return this.client;
  }

  get table() {
    return "scheduled_notifications";
  }

  async replacePendingForUser(userId, items) {
    const client = this.getClient();

    // Drop pending + cancelled so unique (user_id, schedule_key) can be reused cleanly.
    // Keep sent/failed for short audit; upsert below can revive daily-summary keys.
    const { error: cleanupError } = await client
      .from(this.table)
      .delete()
      .eq("user_id", userId)
      .in("status", ["pending", "cancelled"]);

    if (cleanupError) throw cleanupError;

    if (!items.length) return [];

    const rows = items.map((item) => ({
      user_id: userId,
      record_id: item.recordId || null,
      schedule_key: item.scheduleKey,
      trigger_at: item.triggerAt,
      title: truncate(item.title, MAX_TITLE_LENGTH) || "Kivo",
      body: truncate(item.body, MAX_BODY_LENGTH) || "Tienes un recordatorio",
      alert_level: item.alertLevel,
      kind: item.kind,
      payload: item.payload || {},
      status: "pending",
      sent_at: null,
      error: null,
    }));

    const inserted = [];
    for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
      const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
      const { data, error } = await client
        .from(this.table)
        .upsert(batch, { onConflict: "user_id,schedule_key", ignoreDuplicates: false })
        .select(SELECT_COLS);

      if (error) throw error;
      if (data?.length) inserted.push(...data);
    }

    return inserted;
  }

  async claimDue(batchSize = 50) {
    const { data, error } = await this.getClient().rpc(
      "claim_due_scheduled_notifications",
      { batch_size: batchSize }
    );

    if (error) throw error;
    return data ?? [];
  }

  async requeue(id, options = {}) {
    const deferMinutes = Number(options.deferMinutes) || 0;
    const nextTrigger =
      deferMinutes > 0
        ? new Date(Date.now() + deferMinutes * 60 * 1000).toISOString()
        : null;

    const updates = {
      status: "pending",
      sent_at: null,
      error: null,
    };
    if (nextTrigger) {
      updates.trigger_at = nextTrigger;
    }

    const { error: updateError } = await this.getClient()
      .from(this.table)
      .update(updates)
      .eq("id", id)
      .in("status", ["sent", "failed"]);

    if (updateError) throw updateError;
  }

  async markFailed(id, errorMessage) {
    const { error } = await this.getClient()
      .from(this.table)
      .update({
        status: "failed",
        error: String(errorMessage || "unknown").slice(0, 500),
      })
      .eq("id", id);

    if (error) throw error;
  }

  async markCancelled(id, reason) {
    const { error } = await this.getClient()
      .from(this.table)
      .update({
        status: "cancelled",
        error: String(reason || "cancelled").slice(0, 500),
      })
      .eq("id", id);

    if (error) throw error;
  }
}

module.exports = ScheduledNotificationRepository;
