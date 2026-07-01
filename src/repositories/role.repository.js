const { getServiceClient } = require("../clients/supabase.client");

class RoleRepository {
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
    return "roles";
  }

  async findAll() {
    const { data, error } = await this.getClient()
      .from(this.table)
      .select("id, name, created_at")
      .order("id", { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async findById(id) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .select("id, name, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }
}

module.exports = RoleRepository;
