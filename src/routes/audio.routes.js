const express = require("express");
const AudioController = require("../controllers/audio.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  uploadSingleAudio,
  handleUploadErrors,
} = require("../middlewares/upload.middleware");
const { audioUploadSchema } = require("../validators/job.validator");
const { ValidationError } = require("../errors/AppError");

const router = express.Router();
const audioController = new AudioController();

function requireAudioFile(req, res, next) {
  if (!req.file) {
    return next(new ValidationError("Audio file is required (field: audio)"));
  }
  next();
}

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
