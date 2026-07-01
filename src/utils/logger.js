const { env } = require("../config");

const levels = ["debug", "info", "warn", "error"];

function shouldLog(level) {
  if (env.nodeEnv === "test") {
    return level === "error";
  }
  return true;
}

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  if (meta && Object.keys(meta).length > 0) {
    return `${base} ${JSON.stringify(meta)}`;
  }
  return base;
}

function createLogger(scope) {
  return levels.reduce((logger, level) => {
    logger[level] = (message, meta = {}) => {
      if (!shouldLog(level)) {
        return;
      }
      const payload = scope ? { scope, ...meta } : meta;
      console[level === "debug" ? "log" : level](
        formatMessage(level, message, payload)
      );
    };
    return logger;
  }, {});
}

module.exports = {
  createLogger,
};
