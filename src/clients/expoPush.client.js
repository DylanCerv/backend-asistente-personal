const { createLogger } = require("../utils/logger");

const logger = createLogger("expoPush");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;
const MAX_TITLE = 120;
const MAX_BODY = 400;

function isExpoPushToken(token) {
  return (
    typeof token === "string" &&
    (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["))
  );
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}

function truncate(value, max) {
  const text = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/** Expo requires push `data` values to be strings. */
function toStringData(entries) {
  const data = {};
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === null) continue;
    data[key] = typeof value === "string" ? value : String(value);
  }
  return data;
}

/**
 * Build an Expo push message from a scheduled notification row + token.
 */
function toExpoMessage(token, notification) {
  const payload = notification.payload || {};
  const isAlarm =
    notification.alert_level === "alarm" || notification.kind === "critical";
  const isWake =
    notification.kind === "activity-warning" || payload.openWakeAlert === "1";

  // Only exact-time alarms / explicit flags should open the full-screen UI.
  const openCriticalAlarm =
    payload.openCriticalAlarm === "1" ||
    payload.openCriticalAlarm === true ||
    (notification.kind === "critical" &&
      typeof notification.schedule_key === "string" &&
      notification.schedule_key.startsWith("kivo-exact-"));

  const openWakeAlert =
    isWake ||
    payload.openWakeAlert === "1" ||
    payload.openWakeAlert === true;

  const title = truncate(notification.title, MAX_TITLE) || "Kivo";
  const body = truncate(notification.body, MAX_BODY) || "Tienes un recordatorio";

  return {
    to: token,
    title,
    body,
    sound: isAlarm || isWake ? "default" : undefined,
    priority: "high",
    channelId: openCriticalAlarm
      ? "kivo-critical-alarm"
      : openWakeAlert
        ? "kivo-activity-wake"
        : "kivo-reminders",
    data: toStringData({
      source: "server",
      scheduleKey: notification.schedule_key,
      recordId: notification.record_id,
      kind: notification.kind,
      alertLevel: notification.alert_level,
      title,
      body,
      alarmTitle: payload.alarmTitle || payload.activityTitle || title,
      activityTitle: payload.activityTitle || payload.alarmTitle || title,
      openCriticalAlarm: openCriticalAlarm ? "1" : "0",
      openWakeAlert: openWakeAlert ? "1" : "0",
    }),
    _contentAvailable: true,
  };
}

async function sendExpoPush(messages) {
  if (!messages.length) {
    return { tickets: [], invalidTokens: [] };
  }

  const invalidTokens = [];
  const tickets = [];

  for (const batch of chunk(messages, CHUNK_SIZE)) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Expo push HTTP ${response.status}: ${text.slice(0, 300)}`);
    }

    const json = await response.json();
    const data = Array.isArray(json.data) ? json.data : [json.data];

    data.forEach((ticket, index) => {
      tickets.push(ticket);
      if (ticket?.status === "error") {
        const err = ticket.details?.error;
        if (err === "DeviceNotRegistered" || err === "InvalidCredentials") {
          invalidTokens.push(batch[index].to);
        }
        logger.warn("Expo push ticket error", {
          message: ticket.message,
          error: err,
        });
      }
    });
  }

  return { tickets, invalidTokens };
}

module.exports = {
  isExpoPushToken,
  toExpoMessage,
  sendExpoPush,
};
