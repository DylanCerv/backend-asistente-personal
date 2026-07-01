const { env } = require("../config");

function getTimezoneContext() {
  const timeZone = env.defaultTimezone();

  const now = new Date();
  const dateFormatter = new Intl.DateTimeFormat("es-EC", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const isoFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = isoFormatter.formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value || "00";

  const localIso = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;

  return {
    timeZone,
    nowLocalIso: localIso,
    nowFormatted: dateFormatter.format(now),
  };
}

module.exports = {
  getTimezoneContext,
};
