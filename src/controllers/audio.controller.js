const AudioService = require("../services/audio.service");
const JobService = require("../services/job.service");

class AudioController {
  constructor(audioService = new AudioService()) {
    this.audioService = audioService;
  }

  upload = async (req, res, next) => {
    try {
      const result = await this.audioService.processUpload({
        userId: req.user.id,
        file: req.file,
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
