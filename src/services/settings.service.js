const SettingsRepository = require("../repositories/settings.repository");
const NotificationScheduleService = require("./notificationSchedule.service");
const { createLogger } = require("../utils/logger");

const logger = createLogger("settingsService");

const ALLOWED_FIELDS = [
  "language",
  "push_notifications",
  "reminder_notifications",
  "reminder_alert_style",
  "reminder_alert_sound",
  "reminder_alert_vibration",
  "auto_send_audio",
  "biometric_lock",
  "preferred_name",
  "plan",
];

class SettingsService {
  constructor(
    settingsRepository = new SettingsRepository(),
    notificationScheduleService = new NotificationScheduleService()
  ) {
    this.settingsRepository = settingsRepository;
    this.notificationScheduleService = notificationScheduleService;
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
    const settings = await this.settingsRepository.upsert(actor.id, updates);

    if (
      updates.push_notifications !== undefined ||
      updates.reminder_notifications !== undefined
    ) {
      try {
        await this.notificationScheduleService.rebuildForUser(actor.id);
      } catch (error) {
        logger.warn("Notification rebuild after settings update failed", {
          userId: actor.id,
          error: error.message,
        });
      }
    }

    return settings;
  }
}

module.exports = SettingsService;
