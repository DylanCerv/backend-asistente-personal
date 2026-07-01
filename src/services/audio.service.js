const JobService = require("./job.service");
const StorageRepository = require("../repositories/storage.repository");

class AudioService {
  constructor(
    jobService = new JobService(),
    storageRepository = new StorageRepository()
  ) {
    this.jobService = jobService;
    this.storageRepository = storageRepository;
  }

  async processUpload({ userId, file }) {
    const audioStorage = await this.storageRepository.saveAudio(file, userId);
    return this.jobService.createJobFromAudio({ userId, audioStorage });
  }
}

module.exports = AudioService;
