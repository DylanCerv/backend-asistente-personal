const JobRepository = require("../repositories/job.repository");
const RecordRepository = require("../repositories/record.repository");
const StorageRepository = require("../repositories/storage.repository");
const CaptureService = require("./capture.service");
const NotificationScheduleService = require("./notificationSchedule.service");
const { transcribeAudio } = require("../clients/openai.client");
const { JOB_PROGRESS, JOB_STATUS } = require("../constants/jobs");
const { createLogger } = require("../utils/logger");

const logger = createLogger("jobProcessor");

class JobProcessorService {
  constructor(
    jobRepository = new JobRepository(),
    recordRepository = new RecordRepository(),
    storageRepository = new StorageRepository(),
    captureService = null,
    notificationScheduleService = new NotificationScheduleService()
  ) {
    this.jobRepository = jobRepository;
    this.recordRepository = recordRepository;
    this.storageRepository = storageRepository;
    this.captureService = captureService || new CaptureService(jobRepository, recordRepository);
    this.notificationScheduleService = notificationScheduleService;
  }

  hasAudioSource(job) {
    return Boolean(job.audio_path || job.audio_url);
  }

  async resolveTranscription(job) {
    const existing = typeof job.transcription === "string" ? job.transcription.trim() : "";
    if (existing) {
      logger.info("Using client-provided transcription (no audio upload)", {
        jobId: job.id,
      });
      return { transcription: existing, tempFilePath: null, isTempFile: false };
    }

    if (!this.hasAudioSource(job)) {
      throw new Error("Job has no text or audio to process");
    }

    const download = await this.storageRepository.downloadAudio(job);

    await this.jobRepository.update(job.id, {
      progress: JOB_PROGRESS.TRANSCRIBING,
    });

    const transcription = await transcribeAudio(download.path);

    return {
      transcription,
      tempFilePath: download.path,
      isTempFile: download.isTemp,
    };
  }

  async processJob(job) {
    logger.info("Processing job", { jobId: job.id });

    let tempFilePath = null;
    let isTempFile = false;

    try {
      const resolved = await this.resolveTranscription(job);
      tempFilePath = resolved.tempFilePath;
      isTempFile = resolved.isTempFile;
      const transcription = resolved.transcription;

      await this.jobRepository.update(job.id, {
        progress: JOB_PROGRESS.ANALYZING,
        transcription,
        status: JOB_STATUS.PROCESSING,
      });

      await this.jobRepository.update(job.id, {
        progress: JOB_PROGRESS.STRUCTURING,
      });

      const completedJob = await this.captureService.finalizeJob(
        { ...job, transcription },
        transcription
      );

      if (this.hasAudioSource(job)) {
        await this.storageRepository.deleteJobAudio(job);
        await this.jobRepository.update(job.id, {
          audio_url: null,
          audio_path: null,
        });
      }

      try {
        await this.notificationScheduleService.rebuildForUser(job.user_id);
      } catch (scheduleError) {
        logger.warn("Notification rebuild after job failed", {
          jobId: job.id,
          error: scheduleError.message,
        });
      }

      logger.info("Job completed", {
        jobId: job.id,
        action: completedJob?.structured_data?.action || "create",
        source: this.hasAudioSource(job) ? "audio" : "text",
      });

      return completedJob;
    } catch (error) {
      logger.error("Job failed", {
        jobId: job.id,
        error: error.message,
      });

      await this.jobRepository.markFailed(job.id, {
        message: error.message,
        stack: error.stack,
        occurredAt: new Date().toISOString(),
      });

      throw error;
    } finally {
      if (tempFilePath && isTempFile) {
        await this.storageRepository.deleteLocalFile(tempFilePath);
      }
    }
  }

  async processJobById(jobId) {
    let claimed = await this.jobRepository.claimJobIfPending(jobId);

    if (!claimed) {
      // Orphan recovery: claimed in DB but processor died before work started
      claimed = await this.jobRepository.reclaimStuckProcessing(jobId);
    }

    if (claimed) {
      return this.processJob(claimed);
    }

    // Worker (or another request) already claimed/finished this job — wait for terminal state
    // so chat does not run extraction twice and create duplicate records.
    return this.waitForJobTerminal(jobId);
  }

  async waitForJobTerminal(jobId, { timeoutMs = 90_000, pollMs = 500 } = {}) {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      const job = await this.jobRepository.findById(jobId);
      if (!job) {
        throw new Error("Job not found");
      }
      if (job.status === JOB_STATUS.COMPLETED || job.status === JOB_STATUS.FAILED) {
        return job;
      }

      if (job.status === JOB_STATUS.PROCESSING) {
        const reclaimed = await this.jobRepository.reclaimStuckProcessing(jobId);
        if (reclaimed) {
          return this.processJob(reclaimed);
        }
      }

      if (job.status === JOB_STATUS.PENDING) {
        const claimed = await this.jobRepository.claimJobIfPending(jobId);
        if (claimed) {
          return this.processJob(claimed);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }

    throw new Error("Job is still processing");
  }

  async processNextJob() {
    const job = await this.jobRepository.claimNextPending();

    if (!job) {
      return null;
    }

    return this.processJob(job);
  }
}

module.exports = JobProcessorService;
