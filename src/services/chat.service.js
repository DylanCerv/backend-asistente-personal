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

// Matches messages that should trigger creation of new records
const CREATE_PATTERN =
  /crea|agrega|añade|anota|apunta|programa|agenda|recordar|recuerd|nuevo|nueva|registra/i;

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
              // Merge data to preserve existing fields
              if (changes.data !== undefined) {
                changes.data = { ...(record.data ?? {}), ...changes.data };
              }

              // Log the change
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
              const reply = await generateChatReply({
                message: `El usuario pidió: "${text}". Lo hiciste: ${summary}. Confirma brevemente en primera persona como asistente.`,
                userName,
                context,
              });

              logger.info("Record updated via chat edit intent", {
                recordId: record.id,
                userId,
              });

              return { reply, records: [] };
            }
          }
        }
      } catch (error) {
        logger.warn("Edit intent resolution failed, falling through to create", {
          error: error.message,
        });
      }
    }

    // 2. Generate conversational reply
    let reply = await generateChatReply({ message: text, userName, context });

    // 3. Try to CREATE new records for actionable messages
    const shouldCreate = CREATE_PATTERN.test(text) || (
      !EDIT_PATTERN.test(text) &&
      /tarea|reuni|cita|gast|ingreso|recordatorio|llamar|pagar|comprar/i.test(text)
    );

    let createdRecords = [];

    if (shouldCreate) {
      try {
        const created = await this.jobService.createJobFromText({ userId, text });
        await this.jobProcessor.processJobById(created.jobId);

        const result = await this.jobService.getJobResult(
          { id: userId, roleId: 0 },
          created.jobId
        );

        createdRecords = result.records || [];

        if (createdRecords.length > 0) {
          const titles = createdRecords
            .map((r) => r.title)
            .filter(Boolean)
            .slice(0, 4)
            .join(", ");
          reply = `${reply.trim()}\n\nListo, ya lo registré: ${titles}.`;
        }
      } catch (error) {
        logger.warn("Chat action creation failed", { error: error.message });
      }
    }

    return { reply, records: createdRecords };
  }
}

module.exports = ChatService;
