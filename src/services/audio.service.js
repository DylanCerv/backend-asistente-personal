const JobService = require("./job.service");
const JobProcessorService = require("./jobProcessor.service");
const StorageRepository = require("../repositories/storage.repository");
const { createLogger } = require("../utils/logger");

const logger = createLogger("audio");

class AudioService {
  constructor(
    jobService = new JobService(),
    storageRepository = new StorageRepository(),
    jobProcessor = new JobProcessorService()
  ) {
    this.jobService = jobService;
    this.storageRepository = storageRepository;
    this.jobProcessor = jobProcessor;
  }

  async processUpload({ userId, file }) {
    const audioStorage = await this.storageRepository.saveAudio(file, userId);
    const created = await this.jobService.createJobFromAudio({ userId, audioStorage });

    // Start ASAP — don't wait for the worker poll interval (was up to ~2s).
    void this.jobProcessor.processJobById(created.jobId).catch((error) => {
      logger.warn("Inline audio job processing failed; worker may retry", {
        jobId: created.jobId,
        error: error.message,
      });
    });

    return created;
  }

  async processText({ userId, text }) {
    const created = await this.jobService.createJobFromText({ userId, text });

    void this.jobProcessor.processJobById(created.jobId).catch((error) => {
      logger.warn("Inline text job processing failed; worker may retry", {
        jobId: created.jobId,
        error: error.message,
      });
    });

    return created;
  }
}

module.exports = AudioService;
