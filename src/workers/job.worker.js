const JobProcessorService = require("../services/jobProcessor.service");
const { env, validateEnv } = require("../config");
const { createLogger } = require("../utils/logger");

const logger = createLogger("worker");

class JobWorker {
  constructor(processor = new JobProcessorService()) {
    this.processor = processor;
    this.isRunning = false;
    this.interval = null;
  }

  start() {
    if (this.isRunning) {
      return;
    }

    validateEnv();
    this.isRunning = true;

    logger.info("Worker started", {
      pollIntervalMs: env.workerPollIntervalMs,
    });

    this.tick();

    this.interval = setInterval(() => {
      this.tick();
    }, env.workerPollIntervalMs);
  }

  async tick() {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.processor.processNextJob();
    } catch {
      // Errors are logged inside processor; worker continues polling
    }
  }

  stop() {
    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    logger.info("Worker stopped");
  }
}

module.exports = JobWorker;
