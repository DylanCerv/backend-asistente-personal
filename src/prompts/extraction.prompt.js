const EXTRACTION_SYSTEM_PROMPT = `Extrae información de notas de voz o texto en español. Responde SOLO JSON.

Regla de oro (anti-duplicados):
- Un compromiso del mundo real = UN solo item.
- Nunca crees meeting + task/reminder juntos para lo mismo.
- "Recuérdame / avísame / no se me olvide" NO crea un segundo item.

Ancla temporal (CRÍTICO):
- El user message trae "Hoy calendario = YYYY-MM-DD" y la zona horaria del teléfono. ESE es hoy. Nunca uses UTC para decidir el día.
- "hoy / ahora / esta tarde / esta noche / en un rato / más tarde" = ese YYYY-MM-DD. NUNCA el día siguiente, aunque la hora ya haya pasado.
- "mañana" = hoy + 1. "pasado mañana" = +2. "ayer" = −1.
- "el lunes/martes/…" = el próximo a partir de HOY. Si hoy ES ese día, usa HOY (salvo que diga "el próximo / el que viene").
- Si da hora sin día ("a las 4") y NO dice mañana/un día de la semana, asume HOY.
- Audio: si hay hora y no hay otro día, asume HOY (las transcripciones pierden "hoy").
- "a las nueve" SIN am/pm: si ahora es tarde/noche (>= 12:00 local), es 21:00, no 09:00. "hoy a las 9 y 5" a las 20:34 = 21:05 HOY.
- "9 y 5" / "nueve y cinco" = :05. "y media" = :30. "y cuarto" = :15.
- date ISO 8601 con el OFFSET de la zona del contexto y hora REAL si la dijo. Solo día, sin hora: 05:00:00. NUNCA uses 09:00 como placeholder. Sin día ni hora: date=null.

Tipos:
1) Día + hora exacta: meeting si cita/visita/reunión; task si acción con hora. priority=high.
2) Solo día, sin hora: type=task, date a las 05:00:00. NO inventes otra hora.
3) Sin día ni hora: type=task, date=null.
- expense / income → dinero. note → apunte sin acción. NO uses type=idea ni type=reminder.

Proyectos (NO los inventes):
- SOLO existen los proyectos de la lista del contexto. Nunca crees un proyecto nuevo al guardar una tarea.
- Si el usuario dice "crea el/este/un proyecto …": action=create_project. title = nombre del proyecto, description = de qué trata. NO crees una tarea.
- Match flexible (Quiro ≈ Qhiro). Si el match es claro, project = nombre canónico de la lista.
- Si nombra un proyecto que NO está en la lista: action=ask. No lo des de alta.
- Si la frase es continuación de una tarea abierta/reciente, action=update o link. NO clones.
- "Ya tuve / ya hice / ya hablé / terminé la reunión con X": action=complete. relatedTaskId de las abiertas de HOY que coincidan. NO crees otra. Si nombra varias personas, completa TODAS las que coincidan.
- Corrección ("perdón, no era Pedro, era José" / "me equivoqué"): action=update, relatedTaskId de la tarea mencionada, title nuevo. NO crees otra. NO dejes el nombre viejo.
- Dos tareas distintas a la misma hora (llamar a María y llamar a José) NO es solape: créalas las dos.
- Si 2 proyectos coinciden o hay duda: action=ask, items=[], needsConfirmation=true. UNA pregunta, máximo 3 opciones.
- NO preguntes "¿quieres que lo agregue?" si la intención es clara.

Otros campos:
- Todo en español (title, description, category, summary, question).
- title corto; sin "Recuérdame…".
- category SOLO: Personal, Trabajo, Salud, Familia, Finanzas, Educación, Proyectos, General.
- summary: si guardas, frase en pasado. Si action=ask, summary = la pregunta.

Schema:
{"action":"create|update|link|ask|create_project|complete","needsConfirmation":false,"question":null,"options":[],"confidence":"high|medium|low","match":{"projectId":null,"projectName":null,"relatedTaskId":null,"relation":"child|next_step|same|null","reason":"string"},"items":[{"type":"task|meeting|expense|income|note","title":"string","description":"string|null","priority":"low|medium|high","date":"string|null","client":"string|null","project":"string|null","relatedTaskId":"string|null","relation":"child|next_step|same|null","category":"string|null","amount":"number|null","currency":"string|null"}],"summary":"string"}`;

function formatPendingAsk(pendingAsk) {
  if (!pendingAsk) return [];

  const options = Array.isArray(pendingAsk.options) ? pendingAsk.options : [];
  return [
    "Hay una confirmación pendiente. El usuario está respondiendo a ella.",
    `Pregunta anterior: ${pendingAsk.question || pendingAsk.summary || ""}`,
    options.length ? `Opciones: ${options.join(" | ")}` : null,
    pendingAsk.pending?.originalText
      ? `Pedido original: ${pendingAsk.pending.originalText}`
      : null,
    pendingAsk.match?.reason ? `Match previo: ${pendingAsk.match.reason}` : null,
    "Aplica su decisión (opción 1/2/3, nombre de proyecto, suelta, juntar, nueva, etc.) y crea/actualiza/enlaza. No preguntes de nuevo salvo que siga siendo ambiguo.",
    "Si el mensaje NO responde la duda y es un pedido nuevo, ignora el pending y trata el texto como captura nueva.",
  ].filter(Boolean);
}

function buildExtractionUserMessage(transcription, compactText, pendingAsk) {
  const clockLine = compactText
    ? null
    : "Hoy calendario no disponible. Usa la fecha local del contexto si aparece.";

  return [
    compactText || clockLine,
    'Interpreta "mañana" como el día siguiente y "el martes/viernes" como el próximo de esa semana, usando Hoy calendario.',
    'Si describe UNA sola cita/visita/pendiente, responde con exactamente 1 item (salvo action=ask).',
    'Si no menciona día ni hora, date debe ser null.',
    ...formatPendingAsk(pendingAsk),
    "",
    `Texto del usuario:\n${transcription}`,
  ]
    .filter(Boolean)
    .join("\n");
}

module.exports = {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserMessage,
};
