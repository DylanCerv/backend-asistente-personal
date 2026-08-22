const DevicePushTokenRepository = require("../repositories/devicePushToken.repository");
const { ValidationError } = require("../errors/AppError");

const PLATFORMS = new Set(["ios", "android", "web", "unknown"]);

class DevicesService {
  constructor(tokenRepository = new DevicePushTokenRepository()) {
    this.tokenRepository = tokenRepository;
  }

  async registerPushToken(actor, payload) {
    const token = typeof payload.token === "string" ? payload.token.trim() : "";
    if (!token) {
      throw new ValidationError("token is required");
    }

    const platform = PLATFORMS.has(payload.platform) ? payload.platform : "unknown";

    return this.tokenRepository.upsert({
      userId: actor.id,
      token,
      platform,
      deviceId: payload.deviceId || null,
      appVersion: payload.appVersion || null,
    });
  }

  async unregisterPushToken(actor, token) {
    const value = typeof token === "string" ? token.trim() : "";
    if (!value) {
      throw new ValidationError("token is required");
    }
    return this.tokenRepository.removeByToken(actor.id, value);
  }
}

module.exports = DevicesService;
