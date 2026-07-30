const { RECORD_TYPES } = require("../constants/jobs");

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
const IMPLICIT_DAY_HOURS = new Set([0, 5, 9]);

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

/** True only when the user likely specified a real clock time (not day-only defaults). */
function hasExplicitClockTime(dateValue) {
  if (!dateValue || typeof dateValue !== "string") return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim())) return false;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return false;
  if (parsed.getMinutes() !== 0 || parsed.getSeconds() !== 0) return true;
  if (IMPLICIT_DAY_HOURS.has(parsed.getHours())) return false;
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
function normalizeItemDate(item) {
  if (!item.date || typeof item.date !== "string") return null;
  if (hasExplicitClockTime(item.date)) return item.date;

  const parsed = new Date(item.date);
  if (Number.isNaN(parsed.getTime())) {
    const day = item.date.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day}T05:00:00-05:00` : null;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}T05:00:00-05:00`;
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

function dateBucket(dateValue) {
  if (!dateValue || typeof dateValue !== "string") return "none";
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue.slice(0, 10) || "none";
  }
  return [
    parsed.getFullYear(),
    parsed.getMonth() + 1,
    parsed.getDate(),
    parsed.getHours(),
  ].join("-");
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
        const existingBucket = dateBucket(existing.date);
        const nextBucket = dateBucket(item.date);
        if (
          existingBucket === "none" ||
          nextBucket === "none" ||
          existingBucket === nextBucket
        ) {
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

function normalizeExtractionItem(rawItem) {
  if (!rawItem || typeof rawItem !== "object") return null;
  if (!rawItem.title || typeof rawItem.title !== "string") return null;

  const withDate = {
    ...rawItem,
    title: cleanTitle(rawItem.title),
    date: normalizeItemDate(rawItem),
    category: normalizeCategory(rawItem.category),
    priority: VALID_PRIORITIES.includes(rawItem.priority)
      ? rawItem.priority
      : "medium",
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

function normalizeExtraction(extraction) {
  if (!extraction) {
    return { items: [] };
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
    return { items: [], summary: null };
  }

  const normalized = rawItems.map(normalizeExtractionItem).filter(Boolean);

  return {
    items: dedupeItems(normalized),
    summary,
  };
}

module.exports = {
  mapItemToRecordPayload,
  normalizeExtraction,
  normalizeItemType,
  normalizeCategory,
  dedupeItems,
};
