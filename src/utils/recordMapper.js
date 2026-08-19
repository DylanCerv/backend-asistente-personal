const { RECORD_TYPES } = require("../constants/jobs");
const {
  getTimezoneContext,
  toLocalDateParts,
  toLocalYmd,
  formatOffsetIso,
} = require("./dateContext");

const VALID_PRIORITIES = ["low", "medium", "high"];

const ALLOWED_CATEGORIES = [
  "Personal",
  "Trabajo",
  "Salud",
  "Familia",
  "Finanzas",
  "Educación",
  "Proyectos",
  "General",
];

const CATEGORY_ALIASES = {
  personal: "Personal",
  trabajo: "Trabajo",
  salud: "Salud",
  familia: "Familia",
  finanzas: "Finanzas",
  educacion: "Educación",
  educación: "Educación",
  proyectos: "Proyectos",
  general: "General",
  clientes: "Trabajo",
  vehiculos: "Personal",
  vehículos: "Personal",
  casa: "Familia",
  hogar: "Familia",
};

const APPOINTMENT_PATTERN =
  /\b(visita|cita|reunion|reunión|junta|encuentro|ver a|ir a ver|llamar a|llamada con|con\s+[a-záéíóúñ]+)/i;

const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };
const TYPE_RANK = { meeting: 4, task: 3, reminder: 2, note: 1, idea: 1, expense: 5, income: 5 };

/** Backend default / soft-day times — NOT real clock times chosen by the user. */
const IMPLICIT_DAY_HOURS = new Set([0, 5]);

function normalizeCategory(value) {
  if (!value || typeof value !== "string") return "General";
  const trimmed = value.trim();
  if (!trimmed) return "General";

  const alias = CATEGORY_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;

  const match = ALLOWED_CATEGORIES.find(
    (category) => category.toLowerCase() === trimmed.toLowerCase()
  );
  return match || "General";
}

function looksLikeAppointment(item) {
  const haystack = `${item.title || ""} ${item.description || ""}`;
  return APPOINTMENT_PATTERN.test(haystack);
}

function isUtcMidnight(dateValue) {
  return /T00:00:00(?:\.\d+)?Z$/i.test(String(dateValue).trim());
}

function calendarPrefix(dateValue) {
  const match = String(dateValue).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function getClock() {
  return getTimezoneContext();
}

/** True only when the user likely specified a real clock time (not day-only defaults). */
function inferEveningParts(parts, clock, transcription) {
  const hour = Number(parts.hour);
  if (!Number.isFinite(hour) || hour >= 12) return parts;
  if (/am|a\.?\s*m\.?|de la ma[nñ]ana/i.test(String(transcription || ""))) return parts;

  const nowHour = Number((clock?.nowLocalIso || "").slice(11, 13)) || 0;
  const saidEvening = /tarde|noche|p\.?\s*m\.?|\bpm\b/i.test(String(transcription || ""));
  if (nowHour < 12 && !saidEvening) return parts;

  const pmHour = hour === 0 ? 12 : hour + 12;
  const hourText = String(pmHour).padStart(2, "0");
  return {
    ...parts,
    hour: hourText,
    time: `${hourText}:${parts.minute}:${parts.second}`,
  };
}

function hasExplicitClockTime(dateValue, timeZone = getClock().timeZone) {
  if (!dateValue || typeof dateValue !== "string") return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim())) return false;
  if (isUtcMidnight(dateValue)) return false;
  const parts = toLocalDateParts(dateValue, timeZone);
  if (!parts) return false;
  if (Number(parts.minute) !== 0 || Number(parts.second) !== 0) return true;
  if (IMPLICIT_DAY_HOURS.has(Number(parts.hour))) return false;
  return true;
}

/**
 * Fold legacy/redundant types into the ones used for UI + alerts.
 * - Día + hora de cita → meeting
 * - Solo día / sin fecha / acción → task
 */
function normalizeItemType(item) {
  const rawType = RECORD_TYPES.includes(item.type) ? item.type : "task";

  if (rawType === "expense" || rawType === "income") return rawType;
  if (rawType === "idea" || rawType === "note") return "note";

  const appointment = looksLikeAppointment(item);
  const timed = hasExplicitClockTime(item.date);

  // Without an explicit clock time, never keep meeting — it's an open/day task.
  if (!timed) return "task";

  if (appointment || rawType === "meeting") return "meeting";
  return "task";
}

/** Force day-only dates onto the soft-day 05:00 slot used by the app. */
function normalizeItemDate(item, clock = getClock(), transcription = "") {
  if (!item.date || typeof item.date !== "string") return null;

  const { timeZone, utcOffset } = clock;

  if (hasExplicitClockTime(item.date, timeZone)) {
    const parts = toLocalDateParts(item.date, timeZone);
    if (!parts) return item.date;
    const shifted = inferEveningParts(parts, clock, transcription);
    return formatOffsetIso(shifted.ymd, shifted.time, utcOffset);
  }

  const ymd = isUtcMidnight(item.date)
    ? calendarPrefix(item.date)
    : toLocalYmd(item.date, timeZone);
  if (!ymd) return null;
  return formatOffsetIso(ymd, "05:00:00", utcOffset);
}

function normalizeTitleKey(title) {
  if (!title || typeof title !== "string") return "";
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(
      /^(recuerdame|recuerdame que|avisame|avisame que|no se me olvide|no olvides)\s+/g,
      ""
    )
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dateBucket(dateValue, clock = getClock()) {
  if (!dateValue || typeof dateValue !== "string") return "none";
  const parts = toLocalDateParts(dateValue, clock.timeZone);
  if (!parts) {
    return dateValue.slice(0, 10) || "none";
  }

  if (
    Number(parts.minute) === 0 &&
    Number(parts.second) === 0 &&
    IMPLICIT_DAY_HOURS.has(Number(parts.hour))
  ) {
    return `day-${parts.ymd}`;
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return `day-${parts.ymd}`;
  return `slot-${Math.floor(parsed.getTime() / (15 * 60 * 1000))}`;
}

function isSameCommitment(a, b) {
  const titleA = normalizeTitleKey(a.title);
  const titleB = normalizeTitleKey(b.title);
  if (!titleA || titleA !== titleB) return false;

  if (!a.date && !b.date) return true;
  if (!a.date || !b.date) return true;

  const dateA = new Date(a.date);
  const dateB = new Date(b.date);
  if (Number.isNaN(dateA.getTime()) || Number.isNaN(dateB.getTime())) return false;

  const clock = getClock();
  const dayA = toLocalYmd(a.date, clock.timeZone);
  const dayB = toLocalYmd(b.date, clock.timeZone);
  if (!dayA || dayA !== dayB) return false;
  return Math.abs(dateA.getTime() - dateB.getTime()) <= 45 * 60 * 1000;
}

function pickHigherPriority(a, b) {
  const rankA = PRIORITY_RANK[a] || 0;
  const rankB = PRIORITY_RANK[b] || 0;
  return rankA >= rankB ? a : b;
}

function mergeDuplicateItems(a, b) {
  const preferred =
    (TYPE_RANK[a.type] || 0) >= (TYPE_RANK[b.type] || 0) ? a : b;
  const secondary = preferred === a ? b : a;

  return {
    ...preferred,
    title: preferred.title || secondary.title,
    description: preferred.description || secondary.description || null,
    priority: pickHigherPriority(preferred.priority, secondary.priority),
    date: preferred.date || secondary.date || null,
    client: preferred.client || secondary.client || null,
    project: preferred.project || secondary.project || null,
    category: preferred.category || secondary.category || null,
    amount: preferred.amount ?? secondary.amount ?? null,
    currency: preferred.currency || secondary.currency || null,
  };
}

function dedupeItems(items) {
  const byKey = new Map();

  for (const item of items) {
    const titleKey = normalizeTitleKey(item.title);
    const key = `${titleKey}::${dateBucket(item.date)}`;

    if (titleKey && byKey.has(key)) {
      byKey.set(key, mergeDuplicateItems(byKey.get(key), item));
      continue;
    }

    let merged = false;
    if (titleKey) {
      for (const [existingKey, existing] of byKey.entries()) {
        if (!existingKey.startsWith(`${titleKey}::`)) continue;
        if (isSameCommitment(existing, item)) {
          byKey.set(existingKey, mergeDuplicateItems(existing, item));
          merged = true;
          break;
        }
      }
    }

    if (!merged) {
      byKey.set(key || `anon-${byKey.size}`, item);
    }
  }

  return Array.from(byKey.values());
}

function cleanTitle(title) {
  if (!title || typeof title !== "string") return title;
  const cleaned = title
    .replace(
      /^(recu[eé]rdame(?:\s+que)?|av[ií]same(?:\s+que)?|no\s+se\s+me\s+olvide(?:\s+que)?|no\s+olvides(?:\s+que)?)\s+/i,
      ""
    )
    .trim();
  if (!cleaned) return title.trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

const VALID_RELATIONS = ["child", "next_step", "same"];
const VALID_ACTIONS = ["create", "update", "link", "ask", "create_project", "complete"];

function normalizeRelation(value) {
  return VALID_RELATIONS.includes(value) ? value : null;
}

function normalizeAction(value) {
  return VALID_ACTIONS.includes(value) ? value : null;
}

function normalizeExtractionItem(rawItem, clock = getClock(), transcription = "") {
  if (!rawItem || typeof rawItem !== "object") return null;
  if (!rawItem.title || typeof rawItem.title !== "string") return null;

  const withDate = {
    ...rawItem,
    title: cleanTitle(rawItem.title),
    date: normalizeItemDate(rawItem, clock, transcription),
    category: normalizeCategory(rawItem.category),
    priority: VALID_PRIORITIES.includes(rawItem.priority)
      ? rawItem.priority
      : "medium",
    relatedTaskId:
      typeof rawItem.relatedTaskId === "string" && rawItem.relatedTaskId.trim()
        ? rawItem.relatedTaskId.trim()
        : null,
    relation: normalizeRelation(rawItem.relation),
  };

  return {
    ...withDate,
    type: normalizeItemType(withDate),
  };
}

function mapItemToRecordPayload(item, job) {
  const metadata = {
    ...(item.metadata || {}),
  };

  if (item.category) {
    metadata.category = normalizeCategory(item.category);
  }

  if (item.relatedTaskId) {
    metadata.relatedTaskId = item.relatedTaskId;
    metadata.relation = item.relation || "next_step";
  }

  const type = RECORD_TYPES.includes(item.type) ? item.type : "task";

  return {
    user_id: job.user_id,
    job_id: job.id,
    type,
    title: item.title,
    description: item.description ?? null,
    priority: VALID_PRIORITIES.includes(item.priority) ? item.priority : null,
    date: item.date ?? null,
    client: item.client ?? null,
    project: item.project ?? null,
    amount: item.amount ?? null,
    currency: item.currency ?? null,
    data: metadata,
  };
}

function normalizeMatch(match) {
  if (!match || typeof match !== "object") {
    return {
      projectId: null,
      projectName: null,
      relatedTaskId: null,
      relation: null,
      reason: null,
    };
  }

  return {
    projectId: typeof match.projectId === "string" ? match.projectId : null,
    projectName: typeof match.projectName === "string" ? match.projectName : null,
    relatedTaskId: typeof match.relatedTaskId === "string" ? match.relatedTaskId : null,
    relation: normalizeRelation(match.relation),
    reason: typeof match.reason === "string" ? match.reason : null,
  };
}

function normalizeExtraction(extraction, clock = getClock(), transcription = "") {
  if (!extraction) {
    return { items: [], action: "create", needsConfirmation: false };
  }

  let rawItems = [];
  let summary = null;

  if (Array.isArray(extraction.items) && extraction.items.length > 0) {
    rawItems = extraction.items;
    summary = extraction.summary || null;
  } else if (extraction.title || extraction.type) {
    rawItems = [extraction];
    summary = null;
  } else {
    rawItems = [];
    summary = extraction.summary || null;
  }

  const normalized = rawItems
    .map((item) => normalizeExtractionItem(item, clock, transcription))
    .filter(Boolean);
  const action =
    normalizeAction(extraction.action) ||
    (extraction.needsConfirmation === true ? "ask" : "create");
  const needsConfirmation = action === "ask" || extraction.needsConfirmation === true;
  const options = Array.isArray(extraction.options)
    ? extraction.options.filter((option) => typeof option === "string" && option.trim()).slice(0, 3)
    : [];

  return {
    items: needsConfirmation ? [] : dedupeItems(normalized),
    summary,
    action: needsConfirmation ? "ask" : action,
    needsConfirmation,
    question:
      typeof extraction.question === "string" && extraction.question.trim()
        ? extraction.question.trim()
        : null,
    options,
    match: normalizeMatch(extraction.match),
    draftItems: needsConfirmation ? dedupeItems(normalized) : [],
  };
}

module.exports = {
  mapItemToRecordPayload,
  normalizeExtraction,
  normalizeItemType,
  normalizeItemDate,
  normalizeCategory,
  dedupeItems,
  hasExplicitClockTime,
};
