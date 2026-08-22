require("../config/timezone");

const JobWorker = require("./job.worker");
const NotificationWorker = require("./notification.worker");
const { createLogger } = require("../utils/logger");

const logger = createLogger("workerEntry");

const jobWorker = new JobWorker();
const notificationWorker = new NotificationWorker();

jobWorker.start();
notificationWorker.start();

function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down workers`);
  jobWorker.stop();
  notificationWorker.stop();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason: String(reason) });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error: error.message });
  jobWorker.stop();
  notificationWorker.stop();
  process.exit(1);
});
