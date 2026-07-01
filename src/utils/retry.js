const { createLogger } = require("./logger");

const logger = createLogger("retry");

async function withRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    shouldRetry = defaultShouldRetry,
    label = "operation",
  } = options;

  let lastError;
  let currentDelay = delayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      if (attempt >= maxAttempts || !shouldRetry(error)) {
        throw error;
      }

      logger.warn(`${label} failed, retrying`, {
        attempt,
        maxAttempts,
        error: error.message,
      });

      await sleep(currentDelay);
      currentDelay *= backoffMultiplier;
    }
  }

  throw lastError;
}

function defaultShouldRetry(error) {
  if (error?.status === 429) {
    return true;
  }

  if (error?.status >= 500) {
    return true;
  }

  const retryableCodes = ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"];
  return retryableCodes.includes(error?.code);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  withRetry,
};
