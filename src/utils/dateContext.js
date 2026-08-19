const { env } = require("../config");

function pad(value) {
  return String(value).padStart(2, "0");
}

function getPart(parts, type, fallback = "00") {
  return parts.find((part) => part.type === type)?.value || fallback;
}

function normalizeHour(hour) {
  if (hour === "24") return "00";
  return pad(hour);
}

function getUtcOffset(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
    hour: "numeric",
  }).formatToParts(date);

  const tz = parts.find((part) => part.type === "timeZoneName")?.value || "GMT-05:00";
  if (tz === "GMT" || tz === "UTC") return "+00:00";

  const match = tz.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!match) return "-05:00";

  return `${match[1]}${pad(match[2])}:${pad(match[3] || "00")}`;
}

function toLocalDateParts(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const year = getPart(parts, "year", "1970");
  const month = getPart(parts, "month");
  const day = getPart(parts, "day");
  const hour = normalizeHour(getPart(parts, "hour"));
  const minute = getPart(parts, "minute");
  const second = getPart(parts, "second");

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    ymd: `${year}-${month}-${day}`,
    time: `${hour}:${minute}:${second}`,
  };
}

function toLocalYmd(value, timeZone) {
  if (typeof value === "string") {
    const ymd = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (ymd && !/[T\s]\d/.test(value.trim())) return ymd[1];
  }

  return toLocalDateParts(value, timeZone)?.ymd || null;
}

function addDaysYmd(ymd, days) {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function formatOffsetIso(ymd, time, utcOffset) {
  return `${ymd}T${time}${utcOffset}`;
}

function isValidTimeZone(timeZone) {
  if (!timeZone || typeof timeZone !== "string") return false;
  const trimmed = timeZone.trim();
  if (!trimmed || trimmed.length > 64) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function resolveTimeZone(timeZone) {
  return isValidTimeZone(timeZone) ? timeZone.trim() : env.defaultTimezone();
}

function getTimezoneContext(timeZone, date = new Date()) {
  const resolved = resolveTimeZone(timeZone);

  const dateFormatter = new Intl.DateTimeFormat("es", {
    timeZone: resolved,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = toLocalDateParts(date, resolved);
  const utcOffset = getUtcOffset(resolved, date);
  const todayYmd = parts?.ymd;
  const nowLocalIso = parts ? `${parts.ymd}T${parts.time}` : null;

  return {
    timeZone: resolved,
    utcOffset,
    todayYmd,
    nowLocalIso,
    nowFormatted: dateFormatter.format(date),
  };
}

module.exports = {
  getTimezoneContext,
  getUtcOffset,
  isValidTimeZone,
  resolveTimeZone,
  toLocalDateParts,
  toLocalYmd,
  addDaysYmd,
  formatOffsetIso,
};
