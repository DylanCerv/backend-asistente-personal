const JobRepository = require("../repositories/job.repository");
const RecordRepository = require("../repositories/record.repository");
const StorageRepository = require("../repositories/storage.repository");
const { transcribeAudio, extractStructuredData } = require("../clients/openai.client");
const { JOB_PROGRESS, JOB_STATUS } = require("../constants/jobs");
const {
  mapItemToRecordPayload,
  normalizeExtraction,
} = require("../utils/recordMapper");
const { createLogger } = require("../utils/logger");

const logger = createLogger("jobProcessor");

class JobProcessorService {
  constructor(
    jobRepository = new JobRepository(),
    recordRepository = new RecordRepository(),
    storageRepository = new StorageRepository()
  ) {
    this.jobRepository = jobRepository;
    this.recordRepository = recordRepository;
    this.storageRepository = storageRepository;
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

      const rawExtraction = await extractStructuredData(transcription);
      const extraction = normalizeExtraction(rawExtraction);

      if (extraction.items.length === 0) {
        throw new Error("No se detectaron tareas ni información en el texto");
      }

      await this.jobRepository.update(job.id, {
        progress: JOB_PROGRESS.STRUCTURING,
        structured_data: extraction,
      });

      await this.jobRepository.update(job.id, {
        progress: JOB_PROGRESS.SAVING,
      });

      await this.recordRepository.deleteByJobId(job.id);

      const recordPayloads = extraction.items.map((item) =>
        mapItemToRecordPayload(item, job)
      );

      const records = await this.recordRepository.createMany(recordPayloads);

      const completedJob = await this.jobRepository.markCompleted(job.id, {
        structured_data: extraction,
        transcription,
      });

      if (this.hasAudioSource(job)) {
        await this.storageRepository.deleteJobAudio(job);
        await this.jobRepository.update(job.id, {
          audio_url: null,
          audio_path: null,
        });
      }

      logger.info("Job completed", {
        jobId: job.id,
        recordsCreated: records.length,
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
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw new Error("Job not found");
    }
    return this.processJob(job);
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
