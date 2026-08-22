require("./config/timezone");

const os = require("os");

const { env, validateEnv } = require("./config");
const { createLogger } = require("./utils/logger");
const { isMockAuthEnabled } = require("./utils/mock-auth");

validateEnv();

const createApp = require("./app");
const JobWorker = require("./workers/job.worker");
const NotificationWorker = require("./workers/notification.worker");
const logger = createLogger("server");

function getLocalNetworkIp() {
  const interfaces = os.networkInterfaces();

  for (const iface of Object.values(interfaces)) {
    for (const address of iface ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        return address.address;
      }
    }
  }

  return null;
}

const app = createApp();
const jobWorker = new JobWorker();
const notificationWorker = new NotificationWorker();

const server = app.listen(env.port, "0.0.0.0", () => {
  const localIp = getLocalNetworkIp();

  logger.info(`API server listening on http://localhost:${env.port}`);
  logger.info(`Timezone: ${process.env.TZ || "system default"}`);

  if (env.nodeEnv !== "production") {
    logger.info(`API docs: http://localhost:${env.port}/api/docs`);
  }

  if (localIp) {
    logger.info(
      `Mobile devices (Expo Go): set EXPO_PUBLIC_API_BASE_URL=http://${localIp}:${env.port}/api`
    );
  }

  if (isMockAuthEnabled()) {
    logger.warn(
      "DEV_MOCK_AUTH=true — login/register use in-memory users (no Supabase). Disable for production."
    );
  }

  jobWorker.start();
  notificationWorker.start();
});

function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down server`);
  jobWorker.stop();
  notificationWorker.stop();
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
