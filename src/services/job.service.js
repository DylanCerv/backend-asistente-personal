const JobRepository = require("../repositories/job.repository");
const RecordRepository = require("../repositories/record.repository");
const { JOB_STATUS } = require("../constants/jobs");
const {
  NotFoundError,
  ConflictError,
} = require("../errors/AppError");
const {
  assertResourceAccess,
  resolveListUserId,
} = require("../utils/accessControl");

class JobService {
  constructor(
    jobRepository = new JobRepository(),
    recordRepository = new RecordRepository()
  ) {
    this.jobRepository = jobRepository;
    this.recordRepository = recordRepository;
  }

  async createJobFromAudio({ userId, audioStorage }) {
    const job = await this.jobRepository.create({
      user_id: userId,
      status: JOB_STATUS.PENDING,
      progress: 0,
      audio_url: audioStorage.url,
      audio_path: audioStorage.path,
    });

    return {
      jobId: job.id,
      status: job.status,
    };
  }

  async list(actor, { userId, status, limit, offset }) {
    const scopedUserId = resolveListUserId(actor, userId);

    return this.jobRepository.findAll({
      userId: scopedUserId,
      status,
      limit,
      offset,
    });
  }

  async getJob(actor, jobId) {
    const job = await this.jobRepository.findById(jobId);

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    assertResourceAccess(actor, job.user_id);

    const response = {
      jobId: job.id,
      userId: job.user_id,
      status: job.status,
      progress: job.progress,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    };

    if (job.status === JOB_STATUS.COMPLETED) {
      const records = await this.recordRepository.findAllByJobId(job.id);
      response.result = {
        transcription: job.transcription,
        structuredData: job.structured_data,
        records,
        record: records[0] || null,
      };
    }

    if (job.status === JOB_STATUS.FAILED && job.error) {
      response.error = {
        message: job.error.message,
        occurredAt: job.error.occurredAt,
      };
    }

    return response;
  }

  async getJobResult(actor, jobId) {
    const job = await this.jobRepository.findById(jobId);

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    assertResourceAccess(actor, job.user_id);

    if (job.status === JOB_STATUS.PENDING || job.status === JOB_STATUS.PROCESSING) {
      throw new ConflictError("Job is still processing", "JOB_IN_PROGRESS");
    }

    if (job.status === JOB_STATUS.FAILED) {
      throw new ConflictError("Job failed", "JOB_FAILED");
    }

    const records = await this.recordRepository.findAllByJobId(job.id);

    return {
      jobId: job.id,
      transcription: job.transcription,
      structuredData: job.structured_data,
      records,
      record: records[0] || null,
    };
  }

  async retryJob(actor, jobId) {
    const job = await this.jobRepository.findById(jobId);

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    assertResourceAccess(actor, job.user_id);

    if (job.status !== JOB_STATUS.FAILED) {
      throw new ConflictError("Only failed jobs can be retried", "JOB_NOT_FAILED");
    }

    const updated = await this.jobRepository.resetForRetry(jobId);

    return {
      jobId: updated.id,
      status: updated.status,
    };
  }

  async deleteJob(actor, jobId) {
    const job = await this.jobRepository.findById(jobId);

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    assertResourceAccess(actor, job.user_id);

    await this.jobRepository.softDelete(jobId);

    return {
      jobId,
      deleted: true,
    };
  }
}

module.exports = JobService;
