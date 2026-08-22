const NotificationDispatchService = require("../services/notificationDispatch.service");
const { env, validateEnv } = require("../config");
const { createLogger } = require("../utils/logger");

const logger = createLogger("notificationWorker");

class NotificationWorker {
  constructor(dispatcher = new NotificationDispatchService()) {
    this.dispatcher = dispatcher;
    this.isRunning = false;
    this.interval = null;
  }

  start() {
    if (this.isRunning) return;

    validateEnv();
    this.isRunning = true;

    const pollMs = Math.max(1000, Number(env.notificationPollIntervalMs) || 5000);
    logger.info("Notification worker started", { pollIntervalMs: pollMs });

    this.tick();
    this.interval = setInterval(() => {
      this.tick();
    }, pollMs);
  }

  async tick() {
    if (!this.isRunning) return;

    try {
      const result = await this.dispatcher.dispatchDue(50);
      if (result.processed > 0) {
        logger.info("Dispatched notifications", result);
      }
    } catch (error) {
      logger.error("Notification worker tick failed", {
        error: error.message,
      });
    }
  }

  stop() {
    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    logger.info("Notification worker stopped");
  }
}

module.exports = NotificationWorker;
