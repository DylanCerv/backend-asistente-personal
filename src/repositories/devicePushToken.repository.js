const { getServiceClient } = require("../clients/supabase.client");

const SELECT_COLS = `
  id,
  user_id,
  token,
  platform,
  device_id,
  app_version,
  last_seen_at,
  created_at,
  updated_at
`;

class DevicePushTokenRepository {
  constructor(client = null) {
    this.client = client;
  }

  getClient() {
    if (!this.client) this.client = getServiceClient();
    return this.client;
  }

  get table() {
    return "device_push_tokens";
  }

  async upsert({ userId, token, platform, deviceId, appVersion }) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .upsert(
        {
          user_id: userId,
          token,
          platform: platform || "unknown",
          device_id: deviceId || null,
          app_version: appVersion || null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "token", ignoreDuplicates: false }
      )
      .select(SELECT_COLS)
      .single();

    if (error) throw error;
    return data;
  }

  async listByUserId(userId) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .select(SELECT_COLS)
      .eq("user_id", userId)
      .order("last_seen_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async removeByToken(userId, token) {
    const { error } = await this.getClient()
      .from(this.table)
      .delete()
      .eq("user_id", userId)
      .eq("token", token);

    if (error) throw error;
    return { deleted: true };
  }

  async removeTokens(tokens) {
    if (!tokens?.length) return;
    const { error } = await this.getClient().from(this.table).delete().in("token", tokens);
    if (error) throw error;
  }
}

module.exports = DevicePushTokenRepository;
