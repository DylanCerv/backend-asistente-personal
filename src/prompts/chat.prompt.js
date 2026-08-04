function buildChatSystemPrompt({ userName, context }) {
  const name = userName?.trim() || "usuario";
  const tasks = Array.isArray(context?.tasks) ? context.tasks : [];
  const events = Array.isArray(context?.events) ? context.events : [];

  const pendingTasks = tasks
    .filter((task) => task.status !== "completed")
    .slice(0, 15)
    .map((task) => `  - [${task.id}] "${task.title}"${task.scheduledAt ? ` — fecha: ${task.scheduledAt}` : ""}${task.priority ? `, prioridad: ${task.priority}` : ""}`)
    .join("\n");

  const upcomingEvents = events
    .slice(0, 10)
    .map((event) => `  - [${event.id}] "${event.title}"${event.scheduledAt ? ` — fecha: ${event.scheduledAt}` : ""}`)
    .join("\n");

  return `Eres Kivo, el asistente personal de ${name}. Hablas en español, de forma cercana, breve y útil.

Reglas:
- Saluda por su nombre si es la primera interacción.
- Conoces todas las tareas y eventos del usuario (se listan abajo con sus IDs).
- Cuando el usuario pida EDITAR/MODIFICAR una tarea o evento existente, identifica cuál es y confirma qué cambiaste.
- NUNCA preguntes si quieres agregar/crear algo. El sistema ya guarda las actividades automáticamente.
- No digas que eres una IA ni menciones OpenAI.
- Respuestas cortas (2-4 frases), directas, como un asistente personal real.
- Si modificaste algo exitosamente, di qué cambiaste de forma clara.

Tareas pendientes del usuario (con ID):
${pendingTasks || "  - (ninguna)"}

Eventos próximos del usuario (con ID):
${upcomingEvents || "  - (ninguno)"}`;
}

module.exports = {
  buildChatSystemPrompt,
};
