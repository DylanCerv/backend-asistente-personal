const { getServiceClient } = require("../clients/supabase.client");

class RecordRepository {
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
    return "records";
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

  async createMany(payloads) {
    if (!payloads.length) {
      return [];
    }

    const { data, error } = await this.getClient()
      .from(this.table)
      .insert(payloads)
      .select("*");

    if (error) {
      throw error;
    }

    return data || [];
  }

  async findAllByJobId(jobId) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async findByJobId(jobId) {
    const records = await this.findAllByJobId(jobId);
    return records[0] || null;
  }

  async findAll({ userId, type, limit = 50, offset = 0 } = {}) {
    let query = this.getClient()
      .from(this.table)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    if (type) {
      query = query.eq("type", type);
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

  async deleteByJobId(jobId) {
    const { error } = await this.getClient().from(this.table).delete().eq("job_id", jobId);

    if (error) {
      throw error;
    }
  }
}

module.exports = RecordRepository;
