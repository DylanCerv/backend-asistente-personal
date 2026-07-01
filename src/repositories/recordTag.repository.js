const { getServiceClient } = require("../clients/supabase.client");

class RecordTagRepository {
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
    return "record_tags";
  }

  async findByRecordId(recordId) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .select("*, tags(*)")
      .eq("record_id", recordId);

    if (error) {
      throw error;
    }

    return data || [];
  }

  async create(payload) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .insert(payload)
      .select("*, tags(*)")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async delete(recordId, tagId) {
    const { error } = await this.getClient()
      .from(this.table)
      .delete()
      .eq("record_id", recordId)
      .eq("tag_id", tagId);

    if (error) {
      throw error;
    }
  }

  async findLink(recordId, tagId) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .select("*")
      .eq("record_id", recordId)
      .eq("tag_id", tagId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }
}

module.exports = RecordTagRepository;
