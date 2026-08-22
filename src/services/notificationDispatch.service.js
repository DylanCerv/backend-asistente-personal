const DevicePushTokenRepository = require("../repositories/devicePushToken.repository");
const ScheduledNotificationRepository = require("../repositories/scheduledNotification.repository");
const NotificationScheduleService = require("./notificationSchedule.service");
const {
  isExpoPushToken,
  toExpoMessage,
  sendExpoPush,
} = require("../clients/expoPush.client");
const { createLogger } = require("../utils/logger");

const logger = createLogger("notificationDispatch");

/** Don't keep re-queuing forever when the user has no devices registered. */
const STALE_NO_TOKEN_MS = 6 * 60 * 60 * 1000;
const NO_TOKEN_DEFER_MINUTES = 30;

class NotificationDispatchService {
  constructor(
    tokenRepository = new DevicePushTokenRepository(),
    scheduledRepository = new ScheduledNotificationRepository(),
    scheduleService = new NotificationScheduleService()
  ) {
    this.tokenRepository = tokenRepository;
    this.scheduledRepository = scheduledRepository;
    this.scheduleService = scheduleService;
  }

  async dispatchDue(batchSize = 50) {
    const due = await this.scheduledRepository.claimDue(batchSize);
    if (!due.length) return { processed: 0, sent: 0 };

    let sent = 0;
    const invalidTokens = new Set();
    const usersToRebuild = new Set();

    for (const notification of due) {
      try {
        const tokens = await this.tokenRepository.listByUserId(notification.user_id);
        const valid = tokens
          .map((row) => row.token)
          .filter((token) => isExpoPushToken(token));

        if (!valid.length) {
          const triggerMs = new Date(notification.trigger_at).getTime();
          const ageMs = Date.now() - triggerMs;
          if (Number.isFinite(ageMs) && ageMs > STALE_NO_TOKEN_MS) {
            await this.scheduledRepository.markCancelled(
              notification.id,
              "No push tokens after grace period"
            );
          } else {
            await this.scheduledRepository.requeue(notification.id, {
              deferMinutes: NO_TOKEN_DEFER_MINUTES,
            });
          }
          continue;
        }

        const messages = valid.map((token) => toExpoMessage(token, notification));
        const result = await sendExpoPush(messages);
        result.invalidTokens.forEach((token) => invalidTokens.add(token));

        const delivered = result.tickets.some((ticket) => ticket?.status === "ok");
        if (!delivered && result.invalidTokens.length === valid.length) {
          await this.scheduledRepository.requeue(notification.id, {
            deferMinutes: 5,
          });
          continue;
        }

        sent += 1;

        // Re-arm the next morning briefing + refresh open-ended lookahead.
        if (notification.kind === "daily-summary") {
          usersToRebuild.add(notification.user_id);
        }
      } catch (error) {
        logger.error("Failed to dispatch notification", {
          id: notification.id,
          error: error.message,
        });
        try {
          await this.scheduledRepository.markFailed(notification.id, error.message);
        } catch {
          // ignore secondary failure
        }
      }
    }

    if (invalidTokens.size > 0) {
      try {
        await this.tokenRepository.removeTokens([...invalidTokens]);
      } catch (error) {
        logger.warn("Failed to prune invalid push tokens", { error: error.message });
      }
    }

    for (const userId of usersToRebuild) {
      try {
        await this.scheduleService.rebuildForUser(userId);
      } catch (error) {
        logger.warn("Failed to rebuild schedule after daily briefing", {
          userId,
          error: error.message,
        });
      }
    }

    return { processed: due.length, sent };
  }
}

module.exports = NotificationDispatchService;
