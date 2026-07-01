const JobWorker = require("./job.worker");
const { createLogger } = require("../utils/logger");

const logger = createLogger("workerEntry");

const worker = new JobWorker();

worker.start();

function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down worker`);
  worker.stop();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason: String(reason) });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error: error.message });
  worker.stop();
  process.exit(1);
});
