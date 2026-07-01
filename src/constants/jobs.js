const JOB_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
};

const JOB_PROGRESS = {
  CREATED: 0,
  TRANSCRIBING: 25,
  ANALYZING: 50,
  STRUCTURING: 75,
  SAVING: 90,
  COMPLETED: 100,
};

const RECORD_TYPES = [
  "task",
  "reminder",
  "meeting",
  "expense",
  "income",
  "note",
  "idea",
];

const ALLOWED_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "audio/x-m4a",
  "video/mp4",
];

module.exports = {
  JOB_STATUS,
  JOB_PROGRESS,
  RECORD_TYPES,
  ALLOWED_AUDIO_MIME_TYPES,
};
