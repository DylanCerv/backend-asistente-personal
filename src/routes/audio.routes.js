const express = require("express");
const AudioController = require("../controllers/audio.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  uploadSingleAudio,
  handleUploadErrors,
} = require("../middlewares/upload.middleware");
const {
  audioUploadSchema,
  textProcessSchema,
} = require("../validators/job.validator");
const { ValidationError } = require("../errors/AppError");

const router = express.Router();
const audioController = new AudioController();

function requireAudioFile(req, res, next) {
  if (!req.file) {
    return next(new ValidationError("Audio file is required (field: audio)"));
  }
  next();
}

// Preferred: client already transcribed — text only.
router.post(
  "/text",
  authMiddleware,
  validate(textProcessSchema),
  audioController.processText
);

// Fallback: lightweight speech clip (m4a/AAC) for OpenAI Whisper.
router.post(
  "/",
  authMiddleware,
  uploadSingleAudio,
  handleUploadErrors,
  requireAudioFile,
  validate(audioUploadSchema),
  audioController.upload
);

module.exports = router;
