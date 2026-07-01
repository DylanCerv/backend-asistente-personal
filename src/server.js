const { env, validateEnv } = require("./config");
const { createLogger } = require("./utils/logger");

validateEnv();

const createApp = require("./app");
const logger = createLogger("server");

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info(`API server listening on http://localhost:${env.port}`);
});

function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down server`);
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
