const { getServiceClient } = require("../clients/supabase.client");

const FEEDBACK_SELECT = `
  id,
  user_id,
  rating,
  comment,
  app_version,
  created_at,
  updated_at
`;

class FeedbackRepository {
  constructor(client = null) {
    this.client = client;
  }

  getClient() {
    if (!this.client) this.client = getServiceClient();
    return this.client;
  }

  get table() {
    return "app_feedback";
  }

  async findByUserId(userId) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .select(FEEDBACK_SELECT)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async upsert(userId, payload) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .upsert(
        {
          user_id: userId,
          rating: payload.rating,
          comment: payload.comment ?? "",
          app_version: payload.app_version ?? "",
        },
        { onConflict: "user_id", ignoreDuplicates: false }
      )
      .select(FEEDBACK_SELECT)
      .single();

    if (error) throw error;
    return data;
  }

  async listAll({ limit = 50, offset = 0 } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const safeOffset = Math.max(Number(offset) || 0, 0);

    const { data, error } = await this.getClient()
      .from(this.table)
      .select(FEEDBACK_SELECT)
      .order("created_at", { ascending: false })
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (error) throw error;
    return data || [];
  }
}

module.exports = FeedbackRepository;
