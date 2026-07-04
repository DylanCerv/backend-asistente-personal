/**
 * Prompt for detecting edit/update intent from a user message and matching it
 * to an existing record in the user's context.
 */

function buildEditExtractionPrompt(message, context) {
  const records = Array.isArray(context?.records) ? context.records : [];
  const tasks = Array.isArray(context?.tasks) ? context.tasks : [];

  // Build a combined list of user's existing items with IDs
  const allItems = [
    ...tasks.map((t) => ({
      id: t.id,
      type: "task",
      title: t.title,
      date: t.scheduledAt,
      priority: t.priority,
    })),
    ...records
      .filter((r) => r.type === "meeting" || r.type === "reminder")
      .map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        date: r.scheduledAt,
      })),
  ];

  const itemList = allItems
    .map((item) => `- id: "${item.id}" | tipo: ${item.type} | título: "${item.title}"${item.date ? ` | fecha: ${item.date}` : ""}`)
    .join("\n");

  return {
    systemPrompt: `Eres un extractor de instrucciones de edición. El usuario quiere MODIFICAR un elemento existente.

Elementos actuales del usuario:
${itemList || "- (ninguno registrado)"}

Tu tarea:
1. Determina si el usuario quiere editar/modificar/cambiar/actualizar un elemento existente.
2. Si sí, identifica cuál elemento por su id (busca la coincidencia más cercana al título mencionado).
3. Extrae qué cambios quiere hacer.

Responde SIEMPRE con JSON válido (sin markdown):
{
  "isEditIntent": true | false,
  "recordId": "<id del registro a modificar o null>",
  "changes": {
    "title": "<nuevo título o null>",
    "date": "<nueva fecha ISO 8601 o null>",
    "priority": "<'low'|'medium'|'high' o null>",
    "description": "<nueva descripción o null>"
  },
  "editSummary": "<descripción breve en español de qué se cambia>"
}

Si no es intento de edición, responde: { "isEditIntent": false }`,
    userMessage: message,
  };
}

module.exports = { buildEditExtractionPrompt };
