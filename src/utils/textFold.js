function foldText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "que",
  "con",
  "para",
  "por",
  "una",
  "uno",
  "los",
  "las",
  "del",
  "como",
  "esto",
  "esta",
  "este",
  "tengo",
  "hacer",
  "tiene",
  "hay",
  "hoy",
  "mas",
  "muy",
  "the",
  "and",
  "el",
  "la",
  "de",
  "en",
  "un",
  "al",
  "lo",
  "mi",
  "me",
  "se",
  "es",
  "ok",
  "voy",
  "van",
  "sin",
  "sus",
  "son",
  "fue",
]);

const GENERIC_ACTIONS = new Set([
  "llamar",
  "hablar",
  "hacer",
  "enviar",
  "pagar",
  "revisar",
  "crear",
  "editar",
  "grabar",
  "mandar",
  "preguntar",
  "agendar",
  "recordar",
  "avisar",
  "marcar",
  "escribir",
  "comprar",
  "llevar",
  "reunion",
  "cita",
  "junta",
  "tarea",
  "pendiente",
]);

function tokenize(value) {
  return foldText(value)
    .split(" ")
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

function titleSimilarity(a, b) {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (!left.size || !right.size) return 0;

  const distinctiveLeft = [...left].filter((word) => !GENERIC_ACTIONS.has(word));
  const distinctiveRight = [...right].filter((word) => !GENERIC_ACTIONS.has(word));
  const distinctiveOverlap = distinctiveLeft.filter((word) => distinctiveRight.includes(word));
  if (distinctiveLeft.length && distinctiveRight.length && distinctiveOverlap.length === 0) {
    return 0;
  }

  let overlap = 0;
  for (const word of left) {
    if (right.has(word)) overlap += 1;
  }

  const jaccard = overlap / (left.size + right.size - overlap);
  let bonus = 0;
  for (const word of distinctiveOverlap) {
    if (word.length >= 5) bonus += 0.35;
  }

  return Math.min(1, jaccard + bonus);
}

function soften(value) {
  return foldText(value).replace(/qh/g, "qu").replace(/ph/g, "f");
}

function containsFold(haystack, needle) {
  const hay = foldText(haystack);
  const need = foldText(needle);
  if (!hay || !need || need.length < 3) return false;
  if (hay.includes(need)) return true;
  const softHay = soften(haystack);
  const softNeed = soften(needle);
  return Boolean(softHay && softNeed && softNeed.length >= 3 && softHay.includes(softNeed));
}

module.exports = {
  foldText,
  tokenize,
  titleSimilarity,
  containsFold,
  GENERIC_ACTIONS,
};
