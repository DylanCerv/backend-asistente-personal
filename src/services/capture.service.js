const JobRepository = require("../repositories/job.repository");
const RecordRepository = require("../repositories/record.repository");
const { extractStructuredData } = require("../clients/openai.client");
const { JOB_PROGRESS } = require("../constants/jobs");
const { normalizeExtraction } = require("../utils/recordMapper");
const {
  CaptureContextService,
  formatCompactContext,
} = require("./captureContext.service");
const {
  persistCreate,
  persistUpdate,
  persistComplete,
  persistProject,
} = require("./capturePersist");
const {
  anchorItemDates,
  applyCanonicalProjects,
  maybeAssignSingleProject,
  maybeForceProjectAsk,
  maybeLinkExisting,
  stripUnknownProjects,
  maybeOverlapAsk,
  looksLikeConfirmation,
  maybeApplyCorrection,
} = require("../utils/captureGuards");
const { looksLikeCompletion, maybeApplyCompletion } = require("../utils/captureComplete");
const { applySpokenClock } = require("../utils/spokenClock");
const ProjectRepository = require("../repositories/project.repository");
const { createLogger } = require("../utils/logger");

const logger = createLogger("capture");

const PENDING_MS = 30 * 60 * 1000;
const CANCEL_PATTERN =
  /^(cancela|cancelar|olvidalo|olv[ií]dalo|da igual|nada|no guardes|no lo guardes)\b/i;
const CREATE_PROJECT_PATTERN =
  /\b(crea(r)?|nuevo|nueva)\s+(este\s+|un\s+|el\s+)?proyecto\b/i;

class CaptureService {
  constructor(
    jobRepository = new JobRepository(),
    recordRepository = new RecordRepository(),
    captureContext = null,
    projectRepository = new ProjectRepository()
  ) {
    this.jobRepository = jobRepository;
    this.recordRepository = recordRepository;
    this.projectRepository = projectRepository;
    this.captureContext =
      captureContext || new CaptureContextService(recordRepository, projectRepository);
  }

  isPendingAsk(job) {
    const data = job?.structured_data;
    if (!data || data.action !== "ask" || data.needsConfirmation !== true) return false;
    if (data.pending?.resolved) return false;
    const expiresAt = data.pending?.expiresAt;
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return false;
    return true;
  }

  async findPendingAsk(userId, excludeJobId = null) {
    if (!userId) return null;
    const jobs = await this.jobRepository.findRecentCompletedByUser(userId, 8);
    return (
      jobs.find((job) => job.id !== excludeJobId && this.isPendingAsk(job)) || null
    );
  }

  async clearPending(job) {
    if (!job?.id) return;
    const data = job.structured_data || {};
    await this.jobRepository.update(job.id, {
      structured_data: {
        ...data,
        needsConfirmation: false,
        pending: {
          ...(data.pending || {}),
          resolved: true,
          resolvedAt: new Date().toISOString(),
        },
      },
    });
  }

  async finalizeJob(job, transcription) {
    const pending = await this.findPendingAsk(job.user_id, job.id);
    const trimmed = String(transcription || "").trim();

    if (pending && CANCEL_PATTERN.test(trimmed)) {
      await this.clearPending(pending);
      return this.completeWithoutRecords(job, trimmed, {
        action: "ask",
        needsConfirmation: false,
        question: null,
        options: [],
        items: [],
        summary: "Listo, no guardé eso.",
        pending: { resolved: true, cancelled: true },
      });
    }

    let activePending = pending;
    let ignoredStaleAsk = false;
    if (pending && !looksLikeConfirmation(trimmed, pending)) {
      await this.clearPending(pending);
      activePending = null;
      ignoredStaleAsk = true;
      logger.info("Ignored stale confirmation; treating as new capture", { jobId: job.id });
    }

    const seedText = activePending?.structured_data?.pending?.originalText || trimmed;
    const compact = await this.captureContext.build(job.user_id, seedText, job.time_zone);
    const compactText = formatCompactContext(compact);

    const rawExtraction = await extractStructuredData(trimmed, {
      compactText,
      pendingAsk: activePending?.structured_data || null,
    });

    let extraction = normalizeExtraction(rawExtraction, compact.clock, trimmed);
    extraction = anchorItemDates(extraction, seedText, compact.clock);
    extraction = applySpokenClock(extraction, seedText, compact.clock);
    extraction = applyCanonicalProjects(extraction, compact);
    extraction = maybeAssignSingleProject(extraction, compact);
    extraction = stripUnknownProjects(extraction, compact);
    extraction = maybeForceProjectAsk(extraction, compact);
    extraction = maybeApplyCorrection(extraction, compact, trimmed);
    extraction = maybeApplyCompletion(extraction, compact, trimmed);
    extraction = maybeLinkExisting(extraction, compact);
    extraction = maybeOverlapAsk(extraction, compact);
    extraction = this.withCaptureMeta(extraction, job, { staleAskIgnored: ignoredStaleAsk });

    if (
      extraction.action !== "complete" &&
      (CREATE_PROJECT_PATTERN.test(trimmed) || extraction.action === "create_project")
    ) {
      return this.persistCreatedProject(job, trimmed, extraction, activePending);
    }

    if (extraction.action === "ask" || extraction.needsConfirmation) {
      if (activePending) await this.clearPending(activePending);
      return this.completeAsk(job, seedText, extraction);
    }

    if (extraction.action === "complete" && !extraction.items.length) {
      if (activePending) await this.clearPending(activePending);
      return this.completeWithoutRecords(job, trimmed, extraction);
    }

    if (!extraction.items.length) {
      throw new Error("No se detectaron tareas ni información en el texto");
    }

    await this.jobRepository.update(job.id, {
      progress: JOB_PROGRESS.SAVING,
      structured_data: extraction,
    });

    await this.recordRepository.deleteByJobId(job.id);
    await this.persistExtraction({ job, extraction, transcription: trimmed });

    if (activePending) await this.clearPending(activePending);

    logger.info("Capture persisted", {
      jobId: job.id,
      action: extraction.action,
      itemCount: extraction.items.length,
    });

    return this.jobRepository.markCompleted(job.id, {
      structured_data: extraction,
      transcription: trimmed,
    });
  }

  async completeAsk(job, originalText, extraction) {
    const question =
      extraction.question || extraction.summary || "¿Esto a qué proyecto o tarea lo vinculo?";

    const structured = {
      ...extraction,
      action: "ask",
      needsConfirmation: true,
      question,
      summary: question,
      items: [],
      pending: {
        originalText,
        expiresAt: new Date(Date.now() + PENDING_MS).toISOString(),
        resolved: false,
      },
    };

    logger.info("Capture waiting for confirmation", { jobId: job.id });

    return this.completeWithoutRecords(job, job.transcription || originalText, structured);
  }

  withCaptureMeta(extraction, job, extra = {}) {
    const source = job.audio_path || job.audio_url ? "audio" : "text";
    const titles = (extraction.items || [])
      .map((item) => item.title)
      .filter(Boolean);
    let summary = extraction.summary;
    if (!summary) {
      if (extraction.action === "ask") {
        summary = extraction.question || "Necesito una confirmación antes de guardar.";
      } else if (extraction.action === "complete" && titles[0]) {
        summary =
          titles.length === 1
            ? `Marqué “${titles[0]}” como hecha.`
            : `Marqué ${titles.length} como hechas.`;
      } else if (extraction.action === "update" && titles[0]) {
        summary = `Actualicé “${titles[0]}”.`;
      } else if (extraction.action === "link" && titles[0]) {
        summary = `Lo enlacé a “${titles[0]}”.`;
      } else if (titles.length === 1) {
        summary = `Creé “${titles[0]}”.`;
      } else if (titles.length > 1) {
        summary = `Creé ${titles.length} tareas: ${titles.map((title) => `“${title}”`).join(", ")}.`;
      }
    }

    return {
      ...extraction,
      source: extraction.source || source,
      summary: summary || extraction.question || null,
      staleAskIgnored: Boolean(extra.staleAskIgnored || extraction.staleAskIgnored),
    };
  }

  async completeWithoutRecords(job, transcription, structuredData) {
    await this.recordRepository.deleteByJobId(job.id);
    return this.jobRepository.markCompleted(job.id, {
      structured_data: this.withCaptureMeta(structuredData, job),
      transcription,
    });
  }

  async persistCreatedProject(job, transcription, extraction, pending) {
    const { project, alreadyExisted, description } = await persistProject({
      projectRepository: this.projectRepository,
      job,
      extraction,
    });

    if (pending) await this.clearPending(pending);
    await this.recordRepository.deleteByJobId(job.id);

    const summary = alreadyExisted
      ? `Ya tenías el proyecto “${project.title}”.`
      : description
        ? `Creé el proyecto “${project.title}”: ${description}`
        : `Creé el proyecto “${project.title}”.`;

    logger.info("Project created from capture", { jobId: job.id, projectId: project.id });

    return this.jobRepository.markCompleted(job.id, {
      structured_data: this.withCaptureMeta(
        {
          action: "create_project",
          needsConfirmation: false,
          summary,
          items: [],
          match: { projectName: project.title, projectId: project.id },
        },
        job
      ),
      transcription,
    });
  }

  async persistExtraction({ job, extraction, transcription = "" }) {
    if (extraction.action === "complete") {
      return persistComplete({
        recordRepository: this.recordRepository,
        job,
        extraction,
      });
    }

    if (extraction.action === "update") {
      const updated = await persistUpdate({
        recordRepository: this.recordRepository,
        job,
        extraction,
        transcription,
      });
      if (updated) return updated;
    }

    return persistCreate({
      recordRepository: this.recordRepository,
      job,
      extraction,
    });
  }
}

module.exports = CaptureService;
