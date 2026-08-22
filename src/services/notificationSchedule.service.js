const RecordRepository = require("../repositories/record.repository");
const SettingsRepository = require("../repositories/settings.repository");
const ScheduledNotificationRepository = require("../repositories/scheduledNotification.repository");
const { buildNotificationSchedule } = require("./notificationSchedule.builder");
const { createLogger } = require("../utils/logger");

const logger = createLogger("notificationSchedule");

class NotificationScheduleService {
  constructor(
    recordRepository = new RecordRepository(),
    settingsRepository = new SettingsRepository(),
    scheduledNotificationRepository = new ScheduledNotificationRepository()
  ) {
    this.recordRepository = recordRepository;
    this.settingsRepository = settingsRepository;
    this.scheduledNotificationRepository = scheduledNotificationRepository;
  }

  async rebuildForUser(userId) {
    if (!userId) return { count: 0 };

    try {
      const settings = await this.settingsRepository.findByUserId(userId);
      const enabled =
        settings.push_notifications !== false && settings.reminder_notifications !== false;

      if (!enabled) {
        await this.scheduledNotificationRepository.replacePendingForUser(userId, []);
        logger.info("Cleared schedule (notifications disabled)", { userId });
        return { count: 0 };
      }

      const { data: records } = await this.recordRepository.findAll({
        userId,
        limit: 500,
        offset: 0,
      });

      const items = buildNotificationSchedule(records || []);
      await this.scheduledNotificationRepository.replacePendingForUser(userId, items);

      logger.info("Rebuilt notification schedule", { userId, count: items.length });
      return { count: items.length };
    } catch (error) {
      logger.error("Failed to rebuild notification schedule", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = NotificationScheduleService;
