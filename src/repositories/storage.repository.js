const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const { getServiceClient } = require("../clients/supabase.client");
const { env } = require("../config");
const { createLogger } = require("../utils/logger");

const logger = createLogger("storage");

class StorageRepository {
  constructor(client = null) {
    this.client = client;
    this.bucket = env.audioStorageBucket();
    this.localUploadDir = path.join(process.cwd(), "uploads");
  }

  getClient() {
    if (!this.client) {
      this.client = getServiceClient();
    }
    return this.client;
  }

  resolveStoragePath(job) {
    if (!job.audio_path || job.audio_path.startsWith("http")) {
      return null;
    }
    return job.audio_path;
  }

  async saveAudioLocally(file, userId) {
    await fs.mkdir(this.localUploadDir, { recursive: true });

    const extension = path.extname(file.originalname) || ".m4a";
    const fileName = `${userId}/${randomUUID()}${extension}`;
    const absolutePath = path.join(this.localUploadDir, fileName);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, file.buffer);

    return {
      path: fileName,
      absolutePath,
      url: null,
    };
  }

  async uploadToSupabase(file, userId) {
    const extension = path.extname(file.originalname) || ".m4a";
    const filePath = `${userId}/${randomUUID()}${extension}`;

    const { error } = await this.getClient().storage
      .from(this.bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw error;
    }

    return {
      path: filePath,
      absolutePath: null,
      url: null,
    };
  }

  async saveAudio(file, userId) {
    try {
      return await this.uploadToSupabase(file, userId);
    } catch (storageError) {
      logger.warn("Supabase upload failed, using local storage", {
        error: storageError.message,
      });
      return this.saveAudioLocally(file, userId);
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async downloadFromSupabaseToTemp(jobId, storagePath) {
    const { data, error } = await this.getClient().storage
      .from(this.bucket)
      .download(storagePath);

    if (error) {
      throw new Error(`Failed to download audio from storage: ${error.message}`);
    }

    const tempPath = path.join(
      this.localUploadDir,
      "temp",
      `${jobId}${path.extname(storagePath)}`
    );

    await fs.mkdir(path.dirname(tempPath), { recursive: true });
    const buffer = Buffer.from(await data.arrayBuffer());
    await fs.writeFile(tempPath, buffer);

    return tempPath;
  }

  async downloadUrlToTemp(job) {
    const response = await fetch(job.audio_url);
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status}`);
    }

    const tempPath = path.join(
      this.localUploadDir,
      "temp",
      `${job.id}${path.extname(job.audio_path || ".m4a")}`
    );

    await fs.mkdir(path.dirname(tempPath), { recursive: true });
    await fs.writeFile(tempPath, Buffer.from(await response.arrayBuffer()));

    return tempPath;
  }

  /**
   * Returns { path, isTemp } — temp files are worker copies; originals stay until job completes.
   */
  async downloadAudio(job) {
    const storagePath = this.resolveStoragePath(job);

    if (storagePath) {
      const localPath = path.join(this.localUploadDir, storagePath);

      if (await this.fileExists(localPath)) {
        return { path: localPath, isTemp: false };
      }

      const tempPath = await this.downloadFromSupabaseToTemp(job.id, storagePath);
      return { path: tempPath, isTemp: true };
    }

    if (job.audio_url) {
      const tempPath = await this.downloadUrlToTemp(job);
      return { path: tempPath, isTemp: true };
    }

    throw new Error("Job has no audio source");
  }

  async deleteFromSupabase(storagePath) {
    if (!storagePath) {
      return;
    }

    const { error } = await this.getClient().storage
      .from(this.bucket)
      .remove([storagePath]);

    if (error) {
      logger.warn("Could not delete audio from Supabase storage", {
        path: storagePath,
        error: error.message,
      });
    }
  }

  async deleteLocalFile(filePath) {
    if (!filePath) {
      return;
    }

    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore missing files
    }
  }

  /**
   * Removes the original uploaded audio after successful processing.
   * Keeps transcription + structured_data on the job record.
   */
  async deleteJobAudio(job) {
    const storagePath = this.resolveStoragePath(job);

    if (!storagePath) {
      return;
    }

    await this.deleteFromSupabase(storagePath);

    const localPath = path.join(this.localUploadDir, storagePath);
    await this.deleteLocalFile(localPath);

    logger.info("Audio file deleted after successful job", {
      jobId: job.id,
      path: storagePath,
    });
  }
}

module.exports = StorageRepository;
