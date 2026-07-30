const { getServiceClient } = require("../clients/supabase.client");

class RecordChangeRepository {
  getClient() {
    return getServiceClient();
  }

  get table() {
    return "record_changes";
  }

  async create({ recordId, userId, previousData, changeNote }) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .insert({
        record_id: recordId,
        user_id: userId,
        previous_data: previousData,
        change_note: changeNote || null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async findByRecordId(recordId) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .select("*")
      .eq("record_id", recordId)
      .order("changed_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }
}

module.exports = RecordChangeRepository;
