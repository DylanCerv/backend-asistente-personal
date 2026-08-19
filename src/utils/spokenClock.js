const { toLocalYmd, formatOffsetIso } = require("./dateContext");

const HOUR_WORDS = {
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
};

const MINUTE_WORDS = {
  cinco: 5,
  diez: 10,
  cuarto: 15,
  quince: 15,
  veinte: 20,
  media: 30,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
};

const HOUR_ALT = "una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce";
const MINUTE_ALT = "cinco|diez|cuarto|quince|veinte|media|treinta|cuarenta|cincuenta";

const CLOCK_PREFIX = String.raw`(?:\bahora\b\s*)?(?:a\s+las?\s+)`;
const CLOCK_HOUR = String.raw`(?:(\d{1,2})(?::(\d{2}))?|(${HOUR_ALT}))`;
const CLOCK_MINUTES = String.raw`(?:\s+y\s+(\d{1,2}|${MINUTE_ALT}))?`;
const CLOCK_MERIDIEM = String.raw`\s*(am|pm|a\.?\s*m\.?|p\.?\s*m\.?|de la ma[nñ]ana|de la tarde|de la noche)?`;

const SPOKEN_TIME_PATTERN = new RegExp(
  `${CLOCK_PREFIX}${CLOCK_HOUR}${CLOCK_MINUTES}${CLOCK_MERIDIEM}`,
  "i"
);

const HAS_CLOCK_PATTERN = new RegExp(
  String.raw`\b(a\s+las?|\d{1,2}:\d{2}|\d{1,2}\s+y\s+\d{1,2}|am|pm)\b`,
  "i"
);

function pad(value) {
  return String(value).padStart(2, "0");
}

function clockParts(clock) {
  const iso = clock?.nowLocalIso || "";
  return {
    hour: Number(iso.slice(11, 13)) || 0,
    minute: Number(iso.slice(14, 16)) || 0,
  };
}

function parseMinutes(rawHourMinutes, spokenMinutes) {
  if (rawHourMinutes != null && rawHourMinutes !== "") {
    const value = Number(rawHourMinutes);
    return Number.isFinite(value) ? value : 0;
  }
  if (!spokenMinutes) return 0;
  const word = spokenMinutes.toLowerCase();
  if (MINUTE_WORDS[word] != null) return MINUTE_WORDS[word];
  const value = Number(spokenMinutes);
  return Number.isFinite(value) ? value : 0;
}

function parseSpokenTime(text) {
  const raw = String(text || "");
  if (!HAS_CLOCK_PATTERN.test(raw)) return null;

  const match = raw.match(SPOKEN_TIME_PATTERN);
  if (!match) return null;

  const word = match[3] ? match[3].toLowerCase() : null;
  const hour12 = word ? HOUR_WORDS[word] : Number(match[1]);
  if (!Number.isFinite(hour12) || hour12 < 0 || hour12 > 23) return null;

  const minutes = parseMinutes(match[2], match[4]);
  const meridiem = match[5] || "";
  const hasAhora = /\bahora\b/i.test(raw);

  return { hour12, minutes, meridiem, hasAhora };
}

function resolveHour24(parsed, clock) {
  const { hour12, minutes, meridiem } = parsed;
  if (hour12 >= 13) return { hour: hour12, minutes };

  const isPm = /pm|p\.?\s*m\.?|tarde|noche/i.test(meridiem);
  const isAm = /am|a\.?\s*m\.?|ma[nñ]ana/i.test(meridiem);
  const base = hour12 % 12;
  const amHour = base;
  const pmHour = base === 0 ? 12 : base + 12;

  if (isPm) return { hour: pmHour, minutes };
  if (isAm) return { hour: amHour, minutes };

  const now = clockParts(clock);
  // After noon, "a las nueve y cinco" is 21:05, not 09:05.
  if (now.hour >= 12) return { hour: pmHour, minutes };
  return { hour: amHour, minutes };
}

function applySpokenClock(extraction, transcription, clock) {
  const parsed = parseSpokenTime(transcription);
  if (!parsed || !clock?.todayYmd) return extraction;

  const resolved = resolveHour24(parsed, clock);
  const time = `${pad(resolved.hour)}:${pad(resolved.minutes)}:00`;
  const forceToday =
    parsed.hasAhora ||
    /\b(hoy|esta tarde|esta noche|en un rato|m[áa]s tarde)\b/i.test(transcription);

  const rewrite = (item) => {
    const day = forceToday
      ? clock.todayYmd
      : item?.date
        ? toLocalYmd(item.date, clock.timeZone) || clock.todayYmd
        : clock.todayYmd;
    return { ...item, date: formatOffsetIso(day, time, clock.utcOffset) };
  };

  const items = (extraction.items || []).map(rewrite);
  const draftItems = (extraction.draftItems || []).map(rewrite);

  if (!items.length && !draftItems.length) return extraction;
  return { ...extraction, items, draftItems };
}

module.exports = {
  parseSpokenTime,
  resolveHour24,
  applySpokenClock,
};
