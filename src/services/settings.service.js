const SettingsRepository = require("../repositories/settings.repository");

const ALLOWED_FIELDS = [
  "language",
  "push_notifications",
  "reminder_notifications",
  "auto_send_audio",
  "biometric_lock",
  "preferred_name",
  "plan",
];

class SettingsService {
  constructor(settingsRepository = new SettingsRepository()) {
    this.settingsRepository = settingsRepository;
  }

  async getSettings(actor) {
    return this.settingsRepository.findByUserId(actor.id);
  }

  async updateSettings(actor, payload) {
    const updates = {};
    for (const field of ALLOWED_FIELDS) {
      if (payload[field] !== undefined) {
        updates[field] = payload[field];
      }
    }
    return this.settingsRepository.upsert(actor.id, updates);
  }
}

module.exports = SettingsService;
