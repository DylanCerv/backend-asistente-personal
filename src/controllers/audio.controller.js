const AudioService = require("../services/audio.service");
const { readRequestTimeZone } = require("../utils/requestTimeZone");
const { resolveTimeZone } = require("../utils/dateContext");

class AudioController {
  constructor(audioService = new AudioService()) {
    this.audioService = audioService;
  }

  upload = async (req, res, next) => {
    try {
      const result = await this.audioService.processUpload({
        userId: req.user.id,
        file: req.file,
        timeZone: resolveTimeZone(readRequestTimeZone(req)),
      });

      res.status(202).json({
        success: true,
        jobId: result.jobId,
        status: result.status,
      });
    } catch (error) {
      next(error);
    }
  };

  processText = async (req, res, next) => {
    try {
      const result = await this.audioService.processText({
        userId: req.user.id,
        text: req.body.text,
        timeZone: resolveTimeZone(readRequestTimeZone(req)),
      });

      res.status(202).json({
        success: true,
        jobId: result.jobId,
        status: result.status,
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = AudioController;
