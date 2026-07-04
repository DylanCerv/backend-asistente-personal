const { getTimezoneContext } = require("../utils/dateContext");

const EXTRACTION_SYSTEM_PROMPT = `Extrae información de notas de voz ya transcritas a texto en español. Responde SOLO JSON.

Reglas:
- Un item por cada tarea, recordatorio, reunión, gasto, ingreso, nota o idea. NUNCA fusiones items.
- Todo en español (title, description, category, summary).
- priority por item: urgente/prioritario/muy importante=high, normal=medium, sin urgencia=low.
- date en ISO 8601 con offset -05:00; hora default 09:00 si no se menciona; null si no hay fecha.
- category: trabajo, clientes, vehículos, personal, finanzas, proyectos, etc.

Schema:
{"items":[{"type":"task|reminder|meeting|expense|income|note|idea","title":"string","description":"string|null","priority":"low|medium|high","date":"string|null","client":"string|null","project":"string|null","category":"string|null","amount":"number|null","currency":"string|null"}],"summary":"string"}`;

function buildExtractionUserMessage(transcription) {
  const { timeZone, nowLocalIso, nowFormatted } = getTimezoneContext();

  return [
    `Contexto temporal (${timeZone}): ${nowFormatted} (${nowLocalIso})`,
    'Interpreta "mañana" como el día siguiente y "el viernes" como el próximo viernes.',
    "",
    `Texto del usuario:\n${transcription}`,
  ].join("\n");
}

module.exports = {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserMessage,
};
