const { foldText, tokenize, containsFold, GENERIC_ACTIONS } = require("./textFold");

const COMPLETION_PATTERN =
  /\b(ya tuve|ya tuvimos|ya hice|ya habl[eé]|ya me reun[ií]|ya nos reunimos|ya nos vimos|ya estuve|ya sal[ií]|ya acab[eé]|ya pas[oó]|acabo de (tener|hacer|hablar|reunirme)|termin[eé]|completé|ya atend[ií]|ya cumpl[ií]|ya fue)\b/i;

const OTHER_DAY_PATTERN =
  /\b(mañana|pasado mañana|ayer|el lunes|el martes|el miércoles|el miercoles|el jueves|el viernes|el sábado|el sabado|el domingo|pr[oó]xim[oa]|siguiente)\b/i;

function looksLikeCompletion(text) {
  const raw = String(text || "");
  if (!COMPLETION_PATTERN.test(raw)) return false;
  return (
    /\b(reuni[oó]n|reuniones|cita|citas|junta|juntas|llamada|tarea|pendiente)\b/i.test(raw) ||
    /\b(ya habl[eé]|ya me reun[ií]|ya nos reunimos|ya nos vimos|termin[eé]|completé)\b/i.test(raw) ||
    /\bcon\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ]{3,}/i.test(raw)
  );
}

function looksLikePluralCompletion(text) {
  return /\b(reuniones|citas|juntas|todas|ambos|ambas)\b/i.test(String(text || ""));
}

function mentionsOtherDay(text) {
  return OTHER_DAY_PATTERN.test(String(text || ""));
}

function isTodayTask(task, clock) {
  const today = clock?.todayYmd;
  if (!today || !task?.date) return false;
  return String(task.date).startsWith(today);
}

function nameMatches(task, text) {
  const distinctive = tokenize(task.title).filter(
    (word) => !GENERIC_ACTIONS.has(word) && word.length >= 3
  );
  if (!distinctive.length) return containsFold(text, task.title);
  return distinctive.some((word) => containsFold(text, word) || foldText(text).includes(word));
}

function maybeApplyCompletion(extraction, compact, text) {
  if (!looksLikeCompletion(text)) return extraction;

  const fromRecords = (compact.records || [])
    .filter((record) => record?.data?.status !== "completed")
    .map((record) => ({
      id: record.id,
      title: record.title || "",
      date: record.date || null,
      status: "pending",
    }));
  const open = (fromRecords.length ? fromRecords : compact.tasks || []).filter(
    (task) => task.status !== "completed"
  );
  const named = open.filter((task) => nameMatches(task, text));
  const todayNamed = named.filter((task) => isTodayTask(task, compact.clock));
  const todayOpen = open.filter((task) => isTodayTask(task, compact.clock));

  let matches = named;
  if (!mentionsOtherDay(text) && todayNamed.length) {
    matches = todayNamed;
  }

  if (!matches.length && !mentionsOtherDay(text)) {
    if (looksLikePluralCompletion(text) && todayOpen.length) {
      matches = todayOpen;
    } else if (todayOpen.length === 1) {
      matches = todayOpen;
    }
  }

  if (!matches.length) {
    return {
      ...extraction,
      action: "complete",
      needsConfirmation: false,
      items: [],
      draftItems: [],
      summary: "No encontré una reunión o tarea abierta con esos nombres.",
      match: { ...(extraction.match || {}), reason: "completion without match" },
    };
  }

  const items = matches.map((task) => ({
    type: "meeting",
    title: task.title,
    date: task.date || null,
    relatedTaskId: task.id,
    relation: "same",
  }));

  const summary =
    matches.length === 1
      ? `Marqué “${matches[0].title}” como hecha.`
      : `Marqué ${matches.length} como hechas: ${matches.map((task) => `“${task.title}”`).join(", ")}.`;

  return {
    ...extraction,
    action: "complete",
    needsConfirmation: false,
    items,
    draftItems: [],
    summary,
    match: {
      ...(extraction.match || {}),
      relatedTaskId: matches[0].id,
      relation: "same",
      reason: "spoken completion",
    },
  };
}

module.exports = {
  looksLikeCompletion,
  maybeApplyCompletion,
};
