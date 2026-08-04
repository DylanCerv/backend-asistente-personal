const { getTimezoneContext } = require("../utils/dateContext");

const EXTRACTION_SYSTEM_PROMPT = `Extrae información de notas de voz ya transcritas a texto en español. Responde SOLO JSON.

Regla de oro (anti-duplicados):
- Un compromiso del mundo real = UN solo item.
- Nunca crees meeting + task/reminder juntos para lo mismo.
- "Recuérdame / avísame / no se me olvide" NO crea un segundo item.

Modelo de 3 niveles temporales (elige UNO):

1) Día + hora exacta (ej. "visitar a María hoy a las 4 pm"):
   - type=meeting si es cita/visita/reunión/ver a alguien.
   - type=task si es una acción con hora (pagar, llamar, enviar) sin ser cita.
   - date con la hora exacta en ISO 8601 offset -05:00.
   - priority=high.

2) Solo día, sin hora (ej. "pagar la luz el martes", "visitar a María mañana"):
   - type=task SIEMPRE.
   - date = ese día a las 05:00:00-05:00 (NO inventes otra hora).
   - Así la app avisa en la mañana de ese día.

3) Sin día ni hora (ej. "recuérdame pagar la luz", "recuérdame visitar a María"):
   - type=task SIEMPRE.
   - date=null (IMPORTANTE: no pongas hoy ni ninguna fecha).
   - La app lo tratará como pendiente abierto con avisos suaves.

Otros tipos:
- expense / income → dinero con monto cuando se pueda.
- note → apunte sin acción. NO uses type=idea ni type=reminder.

Otros campos:
- Todo en español (title, description, category, summary).
- title corto ("Visita a María", "Pagar la luz"); sin "Recuérdame…".
- priority: hora exacta o urgente=high; normal=medium; sin urgencia=low.
- category SOLO: Personal, Trabajo, Salud, Familia, Finanzas, Educación, Proyectos, General.
- summary: frase corta en pasado de lo que YA extrajiste (ej. "Registré visita a Juan hoy a las 17:35"). NUNCA preguntes confirmación ni digas "¿Quieres que…?".

Schema:
{"items":[{"type":"task|meeting|expense|income|note","title":"string","description":"string|null","priority":"low|medium|high","date":"string|null","client":"string|null","project":"string|null","category":"string|null","amount":"number|null","currency":"string|null"}],"summary":"string"}`;

function buildExtractionUserMessage(transcription) {
  const { timeZone, nowLocalIso, nowFormatted } = getTimezoneContext();

  return [
    `Contexto temporal (${timeZone}): ${nowFormatted} (${nowLocalIso})`,
    'Interpreta "mañana" como el día siguiente y "el martes/viernes" como el próximo de esa semana.',
    'Si describe UNA sola cita/visita/pendiente, responde con exactamente 1 item.',
    'Si no menciona día ni hora, date debe ser null.',
    "",
    `Texto del usuario:\n${transcription}`,
  ].join("\n");
}

module.exports = {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserMessage,
};
