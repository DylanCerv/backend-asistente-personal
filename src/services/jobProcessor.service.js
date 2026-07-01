const JobRepository = require("../repositories/job.repository");
const RecordRepository = require("../repositories/record.repository");
const StorageRepository = require("../repositories/storage.repository");
const { transcribeAudio, extractStructuredData } = require("../clients/openai.client");
const { JOB_PROGRESS } = require("../constants/jobs");
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

  async processNextJob() {
    const job = await this.jobRepository.claimNextPending();

    if (!job) {
      return null;
    }

    logger.info("Processing job", { jobId: job.id });

    let tempFilePath = null;
    let isTempFile = false;

    try {
      const download = await this.storageRepository.downloadAudio(job);
      tempFilePath = download.path;
      isTempFile = download.isTemp;

      await this.jobRepository.update(job.id, {
        progress: JOB_PROGRESS.TRANSCRIBING,
      });

      const transcription = await transcribeAudio(tempFilePath);

      await this.jobRepository.update(job.id, {
        progress: JOB_PROGRESS.ANALYZING,
        transcription,
      });

      const rawExtraction = await extractStructuredData(transcription);
      const extraction = normalizeExtraction(rawExtraction);

      if (extraction.items.length === 0) {
        throw new Error("No se detectaron tareas ni información en el audio");
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

      await this.storageRepository.deleteJobAudio(job);
      await this.jobRepository.update(job.id, {
        audio_url: null,
        audio_path: null,
      });

      logger.info("Job completed, audio removed from storage", {
        jobId: job.id,
        recordsCreated: records.length,
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
}

module.exports = JobProcessorService;
