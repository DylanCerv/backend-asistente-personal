const { getServiceClient } = require("../clients/supabase.client");
const { JOB_STATUS } = require("../constants/jobs");
class JobRepository {
  constructor(client = null) {
    this.client = client;
  }

  getClient() {
    if (!this.client) {
      this.client = getServiceClient();
    }
    return this.client;
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

  get table() {
    return "jobs";
  }

  async findById(id) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async findByIdForUser(id, userId) {
    const job = await this.findById(id);

    if (!job || job.user_id !== userId) {
      return null;
    }

    return job;
  }

  async findAll({ userId, status, limit = 50, offset = 0 } = {}) {
    let query = this.getClient()
      .from(this.table)
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    if (status) {
      query = query.eq("status", status);
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
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async softDelete(id) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async claimNextPending() {
    const { data, error } = await this.getClient().rpc("claim_next_pending_job");

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data[0];
  }

  async markFailed(id, errorPayload) {
    return this.update(id, {
      status: JOB_STATUS.FAILED,
      error: errorPayload,
    });
  }

  async markCompleted(id, payload) {
    return this.update(id, {
      status: JOB_STATUS.COMPLETED,
      progress: 100,
      ...payload,
    });
  }

  async resetForRetry(id) {
    const job = await this.findById(id);
    const hasAudio = Boolean(job?.audio_path || job?.audio_url);

    return this.update(id, {
      status: JOB_STATUS.PENDING,
      progress: 0,
      error: null,
      // Keep client-provided text jobs; only clear transcription when audio can be re-processed.
      transcription: hasAudio ? null : job?.transcription ?? null,
      structured_data: null,
    });
  }

  async incrementRetryCount(id, currentCount) {
    return this.update(id, {
      retry_count: currentCount + 1,
    });
  }
}

module.exports = JobRepository;
