const { generateChatReply, resolveEditIntent } = require("../clients/openai.client");
const RecordRepository = require("../repositories/record.repository");
const RecordChangeRepository = require("../repositories/record-change.repository");
const JobService = require("./job.service");
const JobProcessorService = require("./jobProcessor.service");
const CaptureService = require("./capture.service");
const { createLogger } = require("../utils/logger");

const logger = createLogger("chat");

const EDIT_PATTERN =
  /edita|modifica|cambia|actualiza|renombra|mueve|pospón|adelanta|reschedule|postpone|move|update|edit|change|modif/i;

const CHAT_ONLY_PATTERN =
  /^(hola|hey|buenas|buenos días|buenas tardes|buenas noches|gracias|ok|vale|listo)\b/i;

const GREETING_ONLY_PATTERN =
  /^(hola|hey|buenas|buenos días|buenas tardes|buenas noches|gracias)\b/i;

const SCHEDULE_QUESTION_PATTERN =
  /\b(qué tengo|que tengo|qué hay|que hay|cuáles son|muéstrame|muestrame|enséñame|ensename|lista(r)?|resumen|cómo voy|como voy|mis tareas|mi agenda)\b/i;

const CANCEL_PATTERN =
  /^(cancela|cancelar|olvidalo|olv[ií]dalo|da igual|nada|no guardes|no lo guardes)\b/i;

function shouldCreateRecords(text) {
  const trimmed = text.trim();
  if (trimmed.length < 4) return false;
  if (CHAT_ONLY_PATTERN.test(trimmed)) return false;
  if (SCHEDULE_QUESTION_PATTERN.test(trimmed)) return false;
  if (EDIT_PATTERN.test(trimmed) && !/\b(crea|agrega|añade|anota|programa|agenda|nueva|nuevo)\b/i.test(trimmed)) {
    return false;
  }
  return true;
}

function replyFromCaptureResult(result) {
  const structured = result?.structuredData || {};
  if (structured.action === "ask" || structured.needsConfirmation) {
    return (
      structured.question ||
      structured.summary ||
      "¿Esto a qué proyecto o tarea lo vinculo?"
    );
  }

  if (typeof structured.summary === "string" && structured.summary.trim()) {
    return structured.summary.trim();
  }

  const titles = (result.records || [])
    .map((record) => record.title)
    .filter(Boolean)
    .slice(0, 4);

  if (titles.length) {
    return `Listo, ya lo registré: ${titles.join(", ")}.`;
  }

  if (structured.action === "complete") {
    return structured.summary?.trim() || "Listo, la marqué como hecha.";
  }

  if (structured.action === "update" || structured.action === "link") {
    return "Listo, actualicé la tarea.";
  }

  return "No detecté una tarea o cita clara para guardar. Prueba de nuevo con más detalle.";
}

class ChatService {
  constructor(
    jobService = new JobService(),
    jobProcessor = new JobProcessorService(),
    recordRepository = new RecordRepository(),
    recordChangeRepository = new RecordChangeRepository(),
    captureService = null
  ) {
    this.jobService = jobService;
    this.jobProcessor = jobProcessor;
    this.recordRepository = recordRepository;
    this.recordChangeRepository = recordChangeRepository;
    this.captureService = captureService || jobProcessor.captureService || new CaptureService();
  }

  async captureFromText(userId, text, timeZone) {
    const created = await this.jobService.createJobFromText({ userId, text, timeZone });
    const processed = await this.jobProcessor.processJobById(created.jobId);

    if (processed?.status === "failed") {
      const failMsg =
        processed.error?.message || "No pude registrar eso. Intenta con más detalle.";
      return { reply: failMsg, records: [] };
    }

    const result = await this.jobService.getJobResult({ id: userId, roleId: 0 }, created.jobId);
    const structured = result.structuredData || {};
    const records =
      structured.action === "ask" || structured.needsConfirmation ? [] : result.records || [];

    return {
      reply: replyFromCaptureResult(result),
      records,
      needsConfirmation: structured.action === "ask" || structured.needsConfirmation === true,
    };
  }

  async chat({ userId, message, userName, context, timeZone }) {
    const text = message.trim();
    const pending = await this.captureService.findPendingAsk(userId);

    if (pending) {
      if (SCHEDULE_QUESTION_PATTERN.test(text)) {
        const reply = await generateChatReply({ message: text, userName, context });
        return { reply, records: [] };
      }

      if (CANCEL_PATTERN.test(text)) {
        await this.captureService.clearPending(pending);
        return { reply: "Listo, no guardé eso.", records: [] };
      }

      if (GREETING_ONLY_PATTERN.test(text) && text.length < 40) {
        return {
          reply:
            pending.structured_data?.question ||
            "Sigo con la duda: ¿a qué proyecto o tarea lo vinculo?",
          records: [],
          needsConfirmation: true,
        };
      }

      try {
        return await this.captureFromText(userId, text, timeZone);
      } catch (error) {
        logger.warn("Pending confirmation capture failed", { error: error.message });
        return {
          reply: error.message || "No pude guardar la actividad. Intenta de nuevo en un momento.",
          records: [],
        };
      }
    }

    if (EDIT_PATTERN.test(text)) {
      try {
        const editResult = await resolveEditIntent(text, context);

        if (editResult?.isEditIntent && editResult?.recordId) {
          const record = await this.recordRepository.findById(editResult.recordId);

          if (record && record.user_id === userId) {
            const changes = {};
            if (editResult.changes?.title) changes.title = editResult.changes.title;
            if (editResult.changes?.date) changes.date = editResult.changes.date;
            if (editResult.changes?.priority) changes.priority = editResult.changes.priority;
            if (editResult.changes?.description) changes.description = editResult.changes.description;

            if (Object.keys(changes).length > 0) {
              if (changes.data !== undefined) {
                changes.data = { ...(record.data ?? {}), ...changes.data };
              }

              await this.recordChangeRepository.create({
                recordId: record.id,
                userId,
                previousData: {
                  title: record.title,
                  description: record.description,
                  priority: record.priority,
                  date: record.date,
                },
                changeNote: `Modificado por Kivo: ${editResult.editSummary || text}`,
              });

              await this.recordRepository.update(record.id, changes);

              const summary = editResult.editSummary || "el registro fue actualizado";
              return {
                reply: `Listo, actualicé: ${summary}.`,
                records: [],
              };
            }
          }
        }
      } catch (error) {
        logger.warn("Edit intent resolution failed, falling through", {
          error: error.message,
        });
      }
    }

    if (shouldCreateRecords(text)) {
      try {
        return await this.captureFromText(userId, text, timeZone);
      } catch (error) {
        logger.warn("Chat action creation failed", { error: error.message });
        return {
          reply:
            error.message ||
            "No pude guardar la actividad. Intenta de nuevo en un momento.",
          records: [],
        };
      }
    }

    const reply = await generateChatReply({ message: text, userName, context });
    return { reply, records: [] };
  }
}

module.exports = ChatService;
