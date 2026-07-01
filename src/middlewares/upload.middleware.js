const multer = require("multer");
const { env } = require("../config");
const { ValidationError } = require("../errors/AppError");
const { ALLOWED_AUDIO_MIME_TYPES } = require("../constants/jobs");

const maxFileSizeBytes = env.uploadMaxFileSizeMb * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSizeBytes,
  },
  fileFilter(req, file, callback) {
    if (!ALLOWED_AUDIO_MIME_TYPES.includes(file.mimetype)) {
      return callback(
        new ValidationError("Unsupported audio format", {
          allowed: ALLOWED_AUDIO_MIME_TYPES,
          received: file.mimetype,
        })
      );
    }
    return callback(null, true);
  },
});

function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(
        new ValidationError(
          `Audio file exceeds maximum size of ${env.uploadMaxFileSizeMb}MB`
        )
      );
    }
    return next(new ValidationError(err.message));
  }
  return next(err);
}

module.exports = {
  upload,
  handleUploadErrors,
  uploadSingleAudio: upload.single("audio"),
};
