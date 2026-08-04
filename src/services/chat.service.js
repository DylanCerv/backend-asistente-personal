const { generateChatReply, resolveEditIntent } = require("../clients/openai.client");
const RecordRepository = require("../repositories/record.repository");
const RecordChangeRepository = require("../repositories/record-change.repository");
const JobService = require("./job.service");
const JobProcessorService = require("./jobProcessor.service");
const { createLogger } = require("../utils/logger");

const logger = createLogger("chat");

// Matches messages that likely reference existing items to modify
const EDIT_PATTERN =
  /edita|modifica|cambia|actualiza|renombra|mueve|pospón|adelanta|reschedule|postpone|move|update|edit|change|modif/i;

// Pure chat / questions about the schedule — do NOT create records
const CHAT_ONLY_PATTERN =
  /^(hola|hey|buenas|buenos días|buenas tardes|buenas noches|gracias|ok|vale|listo)\b/i;

const SCHEDULE_QUESTION_PATTERN =
  /\b(qué tengo|que tengo|qué hay|que hay|cuáles son|muéstrame|muestrame|enséñame|ensename|lista(r)?|resumen|cómo voy|como voy|mis tareas|mi agenda)\b/i;

function shouldCreateRecords(text) {
  const trimmed = text.trim();
  if (trimmed.length < 4) return false;
  if (CHAT_ONLY_PATTERN.test(trimmed)) return false;
  if (SCHEDULE_QUESTION_PATTERN.test(trimmed)) return false;
  if (EDIT_PATTERN.test(trimmed) && !/\b(crea|agrega|añade|anota|programa|agenda|nueva|nuevo)\b/i.test(trimmed)) {
    return false;
  }
  // Default for the assistant: actionable phrases are created immediately (no confirmation).
  return true;
}

class ChatService {
  constructor(
    jobService = new JobService(),
    jobProcessor = new JobProcessorService(),
    recordRepository = new RecordRepository(),
    recordChangeRepository = new RecordChangeRepository()
  ) {
    this.jobService = jobService;
    this.jobProcessor = jobProcessor;
    this.recordRepository = recordRepository;
    this.recordChangeRepository = recordChangeRepository;
  }

  async chat({ userId, message, userName, context }) {
    const text = message.trim();

    // 1. Try to detect if user wants to EDIT an existing record
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

    // 2. Create path — extract + save immediately. Never ask for confirmation.
    if (shouldCreateRecords(text)) {
      try {
        const created = await this.jobService.createJobFromText({ userId, text });
        const processed = await this.jobProcessor.processJobById(created.jobId);

        if (processed?.status === "failed") {
          const failMsg =
            processed.error?.message ||
            "No pude registrar eso. Intenta con más detalle.";
          return { reply: failMsg, records: [] };
        }

        const result = await this.jobService.getJobResult(
          { id: userId, roleId: 0 },
          created.jobId
        );

        const createdRecords = result.records || [];

        if (createdRecords.length > 0) {
          const titles = createdRecords
            .map((r) => r.title)
            .filter(Boolean)
            .slice(0, 4)
            .join(", ");
          return {
            reply: `Listo, ya lo registré: ${titles}.`,
            records: createdRecords,
          };
        }

        return {
          reply: "No detecté una tarea o cita clara para guardar. Prueba de nuevo con más detalle.",
          records: [],
        };
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

    // 3. Pure conversation (greetings / schedule questions)
    const reply = await generateChatReply({ message: text, userName, context });
    return { reply, records: [] };
  }
}

module.exports = ChatService;
