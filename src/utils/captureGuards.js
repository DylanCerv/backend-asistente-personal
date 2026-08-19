const { foldText, containsFold, titleSimilarity } = require("./textFold");
const { hasExplicitClockTime } = require("./recordMapper");
const { toLocalYmd, toLocalDateParts, formatOffsetIso } = require("./dateContext");

const DAY_WORD_PATTERN =
  /\b(ma[nñ]ana|pasado\s+ma[nñ]ana|ayer|lunes|martes|mi[eé]rcoles|jueves|viernes|s[áa]bado|domingo|pr[óo]ximo|que viene)\b/i;
const HOY_PATTERN = /\b(hoy|ahora|esta tarde|esta noche|en un rato|m[áa]s tarde)\b/i;
const TIME_PATTERN =
  /\b(?:a\s+las?\s+(?:\d{1,2}(?::\d{2})?|\d{1,2}\s+y\s+\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)|\d{1,2}:\d{2}|\d{1,2}\s+y\s+\d{1,2}|\d{1,2}\s*(?:am|pm|a\.m\.|p\.m\.))\b/i;

const CONFIRM_PATTERN =
  /^(1|2|3|si|sí|no|ok|vale|listo|suelta|la primera|la segunda|la tercera|primera|segunda|tercera|juntarlas|dejar las dos)\b/i;
const CONFIRM_SHORT_PATTERN = /^(crear nueva|actualizar)\b/i;
const NEW_CAPTURE_PATTERN =
  /\b(tengo que|tengo q|llamar|hoy|ma[nñ]ana|a las|crea|agrega|anota|recu[eé]rdame|necesito|hablar con)\b/i;

function looksLikeConfirmation(text, pending) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return false;
  if (CONFIRM_PATTERN.test(trimmed)) return true;
  if (CONFIRM_SHORT_PATTERN.test(trimmed)) {
    const rest = trimmed.replace(CONFIRM_SHORT_PATTERN, "").trim();
    if (!rest) return true;
  }

  const data = pending?.structured_data || pending || {};
  const options = Array.isArray(data.options) ? data.options : [];
  const folded = foldText(trimmed);
  const pickedOption = options.some((option) => {
    const opt = foldText(option);
    if (!opt) return false;
    if (folded === opt) return true;
    if (folded.length >= 5 && opt.includes(folded) && !CONFIRM_SHORT_PATTERN.test(trimmed)) {
      return true;
    }
    return false;
  });
  if (pickedOption) return true;

  if (NEW_CAPTURE_PATTERN.test(trimmed)) return false;
  return trimmed.length <= 22;
}

function toAsk(extraction, question, options, match = {}) {
  const drafts = extraction.items?.length ? extraction.items : extraction.draftItems || [];
  return {
    ...extraction,
    action: "ask",
    needsConfirmation: true,
    question,
    options,
    items: [],
    draftItems: drafts,
    summary: question,
    match: {
      ...(extraction.match || {}),
      ...match,
      reason: match.reason || extraction.match?.reason || null,
    },
  };
}

function shouldForceToday(transcription) {
  const text = String(transcription || "");
  if (HOY_PATTERN.test(text)) return true;
  if (DAY_WORD_PATTERN.test(text)) return false;
  return TIME_PATTERN.test(text);
}

function rewriteDateToYmd(dateValue, ymd, clock) {
  if (dateValue && hasExplicitClockTime(dateValue, clock.timeZone)) {
    const parts = toLocalDateParts(dateValue, clock.timeZone);
    return formatOffsetIso(ymd, parts?.time || "05:00:00", clock.utcOffset);
  }
  return formatOffsetIso(ymd, "05:00:00", clock.utcOffset);
}

function mapItems(extraction, mapper) {
  const items = (extraction.items || []).map(mapper);
  const draftItems = (extraction.draftItems || []).map(mapper);
  return { ...extraction, items, draftItems };
}

function anchorItemDates(extraction, transcription, clock) {
  if (!shouldForceToday(transcription) || !clock?.todayYmd) return extraction;

  return mapItems(extraction, (item) => {
    if (!item?.date) return item;
    const ymd = toLocalYmd(item.date, clock.timeZone);
    if (ymd === clock.todayYmd) return item;
    return { ...item, date: rewriteDateToYmd(item.date, clock.todayYmd, clock) };
  });
}

function canonicalProject(name, projects) {
  if (!name) return null;
  const folded = foldText(name);
  const exact = projects.find((project) => foldText(project.name) === folded);
  if (exact) return exact.name;

  const partial = projects.filter(
    (project) =>
      containsFold(project.name, name) ||
      containsFold(name, project.name) ||
      (project.aliases || []).some((alias) => foldText(alias) === folded || containsFold(alias, name))
  );
  if (partial.length === 1) return partial[0].name;
  return name;
}

function applyCanonicalProjects(extraction, compact) {
  const projects = compact.projects || [];
  return mapItems(extraction, (item) => {
    if (!item?.project) return item;
    return { ...item, project: canonicalProject(item.project, projects) };
  });
}

function maybeAssignSingleProject(extraction, compact) {
  if (extraction.action === "ask") return extraction;
  const hits = compact.projectHits || [];
  if (hits.length !== 1) return extraction;
  const name = hits[0].name;

  return {
    ...mapItems(extraction, (item) => ({ ...item, project: item.project || name })),
    match: { ...(extraction.match || {}), projectName: extraction.match?.projectName || name },
  };
}

function maybeForceProjectAsk(extraction, compact) {
  if (extraction.action === "ask") return extraction;
  const hits = compact.projectHits || [];
  if (hits.length < 2) return extraction;

  const assigned = extraction.items[0]?.project || extraction.match?.projectName;
  if (assigned) {
    const folded = foldText(assigned);
    const exact = hits.filter(
      (project) => foldText(project.name) === folded || containsFold(project.name, assigned)
    );
    if (exact.length === 1) return extraction;
  }

  const first = hits[0].name;
  const second = hits[1].name;
  return toAsk(extraction, `¿Esto va en ${first}, en ${second}, o suelto?`, [first, second, "Suelta"], {
    reason: "ambiguous project",
  });
}

function maybeLinkExisting(extraction, compact) {
  if (
    extraction.action === "ask" ||
    extraction.action === "update" ||
    extraction.action === "complete"
  ) {
    return extraction;
  }
  const item = extraction.items[0];
  if (!item) return extraction;

  const scored = (compact.tasks || [])
    .map((task) => ({ task, score: titleSimilarity(item.title, task.title) }))
    .filter((entry) => entry.score >= 0.45)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return extraction;

  if (scored.length > 1 && scored[0].score - scored[1].score < 0.12) {
    return toAsk(
      extraction,
      `Ya tienes “${scored[0].task.title}” y “${scored[1].task.title}”. ¿Actualizo una, la enlazo como siguiente paso, o creo una nueva?`,
      [`Actualizar ${scored[0].task.title}`, `Enlazar a ${scored[0].task.title}`, "Crear nueva"],
      { reason: "ambiguous related task" }
    );
  }

  if (extraction.match?.relatedTaskId) return extraction;
  if (scored[0].score < 0.52) return extraction;

  const relation = scored[0].score >= 0.85 ? "same" : "next_step";
  const action = relation === "same" ? "update" : "link";
  const relatedTaskId = scored[0].task.id;

  return {
    ...extraction,
    action,
    match: {
      ...(extraction.match || {}),
      relatedTaskId,
      relation,
      projectName: extraction.match?.projectName || scored[0].task.project,
      reason: `title similarity ${scored[0].score.toFixed(2)}`,
    },
    items: extraction.items.map((entry, index) =>
      index === 0
        ? {
            ...entry,
            relatedTaskId,
            relation,
            project: entry.project || scored[0].task.project,
          }
        : entry
    ),
  };
}

function stripUnknownProjects(extraction, compact) {
  if (extraction.action === "ask" || extraction.action === "create_project") return extraction;
  const projects = compact.projects || [];

  return mapItems(extraction, (item) => {
    if (!item?.project) return item;
    const canonical = canonicalProject(item.project, projects);
    const exists = projects.some((project) => foldText(project.name) === foldText(canonical || ""));
    if (exists) return { ...item, project: canonical };
    return { ...item, project: null };
  });
}

function looksLikeCorrection(text) {
  return /\b(me equivo|perd[oó]n|no era|no es|no con|sino(?:\s+que)?(?:\s+con)?|en realidad|corrige|era con)\b/i.test(
    String(text || "")
  );
}

function correctionNames(text) {
  const raw = String(text || "");
  const skip = new Set(["como", "tal", "pero", "que", "una", "uno", "los", "las", "era", "reunion"]);
  const name = "([A-ZÁÉÍÓÚÜÑa-záéíóúüñ]{3,})";
  const fromMatch = raw.match(
    new RegExp(String.raw`\bno(?:\s+(?:es|era|una|reuni[oó]n))*\s+con\s+${name}`, "i")
  );
  const toMatches = [
    ...raw.matchAll(
      new RegExp(String.raw`\b(?:sino(?:\s+que)?\s+(?:con\s+)?|(?:era|es)\s+con\s+)${name}`, "gi")
    ),
  ];
  const from = fromMatch?.[1]?.trim() || null;
  const toRaw = toMatches.length ? toMatches[toMatches.length - 1][1]?.trim() : null;
  const cleanFrom = from && !skip.has(foldText(from)) ? from : null;
  const cleanTo = toRaw && !skip.has(foldText(toRaw)) ? toRaw : null;
  if (cleanTo && cleanFrom && foldText(cleanFrom) === foldText(cleanTo)) {
    const previous = toMatches
      .map((match) => match[1]?.trim())
      .filter((value) => value && foldText(value) !== foldText(cleanFrom))
      .pop();
    return { from: cleanFrom, to: previous || null };
  }
  return { from: cleanFrom, to: cleanTo };
}

function replaceNameInTitle(title, from, to) {
  if (!title || !from || !to) return title;
  const pattern = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (!pattern.test(title)) return title;
  return title.replace(pattern, to.charAt(0).toUpperCase() + to.slice(1));
}

function maybeApplyCorrection(extraction, compact, text) {
  if (!looksLikeCorrection(text)) return extraction;

  const { from, to } = correctionNames(text);
  const tasks = compact.tasks || [];
  const target =
    (from && tasks.find((task) => containsFold(task.title, from))) ||
    tasks.find((task) => containsFold(text, task.title)) ||
    null;

  if (!target) return extraction;

  const current = extraction.items[0] || extraction.draftItems[0] || {};
  const nextTitle =
    (to && replaceNameInTitle(target.title, from, to)) ||
    (current.title && foldText(current.title) !== foldText(target.title) ? current.title : null) ||
    (to ? `Reunión con ${to.charAt(0).toUpperCase()}${to.slice(1)}` : current.title || target.title);

  const keepDate = !TIME_PATTERN.test(text);
  const item = {
    ...current,
    type: current.type || "meeting",
    title: nextTitle,
    date: keepDate ? target.date : current.date || target.date,
    client: to ? to.charAt(0).toUpperCase() + to.slice(1) : current.client || null,
    relatedTaskId: target.id,
    relation: "same",
  };

  return {
    ...extraction,
    action: "update",
    needsConfirmation: false,
    items: [item],
    draftItems: [],
    match: {
      ...(extraction.match || {}),
      relatedTaskId: target.id,
      relation: "same",
      reason: "spoken name correction",
    },
    summary: `Corregí “${target.title}” a “${nextTitle}”.`,
  };
}

function maybeOverlapAsk(extraction, compact) {
  if (
    extraction.action === "ask" ||
    extraction.action === "update" ||
    extraction.action === "complete"
  ) {
    return extraction;
  }
  const item = extraction.items[0];
  if (!item?.date || !hasExplicitClockTime(item.date)) return extraction;

  const relatedId = item.relatedTaskId || extraction.match?.relatedTaskId;
  const itemTime = new Date(item.date).getTime();
  if (Number.isNaN(itemTime)) return extraction;

  const overlap = (compact.tasks || []).find((task) => {
    if (!task.date || task.id === relatedId) return false;
    if (titleSimilarity(item.title, task.title) < 0.5) return false;
    const other = new Date(task.date).getTime();
    if (Number.isNaN(other)) return false;
    return Math.abs(other - itemTime) <= 20 * 60 * 1000;
  });

  if (!overlap) return extraction;

  return toAsk(
    extraction,
    `Se solapa con “${overlap.title}”. ¿La junto, la dejo igual, o la muevo?`,
    ["Juntarlas", "Dejar las dos", "Mover la nueva"],
    { relatedTaskId: overlap.id, relation: "same", reason: "time overlap" }
  );
}

module.exports = {
  toAsk,
  shouldForceToday,
  anchorItemDates,
  applyCanonicalProjects,
  maybeAssignSingleProject,
  maybeForceProjectAsk,
  maybeLinkExisting,
  stripUnknownProjects,
  maybeOverlapAsk,
  looksLikeConfirmation,
  looksLikeCorrection,
  maybeApplyCorrection,
};
