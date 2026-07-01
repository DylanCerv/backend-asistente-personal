const { getServiceClient } = require("../clients/supabase.client");

const PROFILE_SELECT = `
  id,
  email,
  full_name,
  avatar_url,
  role_id,
  created_at,
  updated_at,
  roles ( id, name )
`;

class ProfileRepository {
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
    return "profiles";
  }

  async findById(id) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .select(PROFILE_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async create(payload) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .insert(payload)
      .select(PROFILE_SELECT)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async findAll({ roleId, limit = 50, offset = 0 } = {}) {
    let query = this.getClient()
      .from(this.table)
      .select(PROFILE_SELECT, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (roleId) {
      query = query.eq("role_id", roleId);
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
      .select(PROFILE_SELECT)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }
}

module.exports = ProfileRepository;
