const { getServiceClient } = require("../clients/supabase.client");

class ProjectRepository {
  constructor(client = null) {
    this.client = client;
  }

  getClient() {
    if (!this.client) {
      this.client = getServiceClient();
    }
    return this.client;
  }

  get table() {
    return "projects";
  }

  async create(payload) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async findById(id) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async findByUserAndTitle(userId, title) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .select("*")
      .eq("user_id", userId)
      .ilike("title", title)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async findAll({ userId, limit = 50, offset = 0 } = {}) {
    let query = this.getClient()
      .from(this.table)
      .select("*", { count: "exact" })
      .order("title", { ascending: true })
      .range(offset, offset + limit - 1);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    return { data: data || [], count };
  }

  async update(id, payload) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async delete(id) {
    const { error } = await this.getClient().from(this.table).delete().eq("id", id);

    if (error) {
      throw error;
    }
  }
}

module.exports = ProjectRepository;
