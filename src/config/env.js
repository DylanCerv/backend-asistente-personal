require("dotenv").config();

const { isMockAuthEnabled } = require("../utils/mock-auth");

const requiredEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
];

const mockAuthEnvVars = [];

function getEnv(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function validateEnv() {
  const envVarsToCheck = isMockAuthEnabled() ? mockAuthEnvVars : requiredEnvVars;
  const missing = envVarsToCheck.filter(
    (name) => !process.env[name] || process.env[name].trim() === ""
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

module.exports = {
  getEnv,
  validateEnv,
  env: {
    nodeEnv: getEnv("NODE_ENV", "development"),
    port: Number(getEnv("PORT", "3000")),
    supabaseUrl: () => getEnv("SUPABASE_URL"),
    supabaseServiceRoleKey: () => getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    supabaseAnonKey: () => getEnv("SUPABASE_ANON_KEY"),
    openaiApiKey: () => getEnv("OPENAI_API_KEY"),
    openaiTranscriptionModel: () =>
      getEnv("OPENAI_TRANSCRIPTION_MODEL", "whisper-1"),
    openaiExtractionModel: () =>
      getEnv("OPENAI_EXTRACTION_MODEL", "gpt-4.1-nano"),
    openaiChatModel: () =>
      getEnv("OPENAI_CHAT_MODEL", "gpt-4.1-nano"),
    audioStorageBucket: () => getEnv("AUDIO_STORAGE_BUCKET", "audio-uploads"),
    uploadMaxFileSizeMb: Number(getEnv("UPLOAD_MAX_FILE_SIZE_MB", "25")),
    workerPollIntervalMs: Number(getEnv("WORKER_POLL_INTERVAL_MS", "2000")),
    workerMaxRetries: Number(getEnv("WORKER_MAX_RETRIES", "3")),
    corsOrigin: getEnv("CORS_ORIGIN", "*"),
    defaultTimezone: () => getEnv("DEFAULT_TIMEZONE", "America/Guayaquil"),
  },
};
