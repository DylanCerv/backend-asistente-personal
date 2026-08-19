const { mapItemToRecordPayload } = require("../utils/recordMapper");
const { looksLikeCorrection } = require("../utils/captureGuards");
const { parseSpokenTime } = require("../utils/spokenClock");

function softDayIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 5, 0, 0, 0).toISOString();
}

async function persistComplete({ recordRepository, job, extraction }) {
  const ids = [
    extraction.match?.relatedTaskId,
    ...(extraction.items || []).map((item) => item.relatedTaskId),
  ].filter(Boolean);
  const uniqueIds = [...new Set(ids)];
  const updated = [];
  const completedAt = new Date().toISOString();

  for (const id of uniqueIds) {
    const existing = await recordRepository.findById(id);
    if (!existing || existing.user_id !== job.user_id) continue;
    const data = {
      ...(existing.data || {}),
      status: "completed",
      completedAt,
      relation: "same",
      relatedTaskId: existing.id,
    };
    const payload = existing.date
      ? { data }
      : { data: { ...data, wasOpenEnded: true }, date: softDayIso() };
    updated.push(await recordRepository.update(id, payload));
  }

  return updated;
}

async function persistUpdate({ recordRepository, job, extraction, transcription = "" }) {
  const targetId = extraction.match?.relatedTaskId || extraction.items[0]?.relatedTaskId;
  const existing = targetId ? await recordRepository.findById(targetId) : null;
  if (!existing || existing.user_id !== job.user_id) return null;

  const item = extraction.items[0] || {};
  const relation = item.relation || extraction.match?.relation || "same";
  const correcting = looksLikeCorrection(transcription) || relation === "same";
  const updates = {
    data: {
      ...(existing.data || {}),
      relation,
      relatedTaskId: existing.id,
    },
  };
  if (item.title && item.title !== existing.title) {
    if (correcting) {
      updates.title = item.title;
    } else {
      const extra = item.description || item.title;
      updates.description = existing.description ? `${existing.description}\n${extra}` : extra;
    }
  } else if (item.description !== undefined && item.description !== null) {
    updates.description = item.description;
  }
  const spokenTime = parseSpokenTime(transcription);
  if (item.date && (!looksLikeCorrection(transcription) || spokenTime)) {
    updates.date = item.date;
  }
  if (item.priority) updates.priority = item.priority;
  if (item.project) updates.project = item.project;
  if (item.client) updates.client = item.client;
  if (item.type && item.type !== existing.type) updates.type = item.type;

  return [await recordRepository.update(existing.id, updates)];
}

async function persistCreate({ recordRepository, job, extraction }) {
  const payloads = extraction.items.map((item) =>
    mapItemToRecordPayload(
      {
        ...item,
        relatedTaskId: item.relatedTaskId || extraction.match?.relatedTaskId,
        relation: item.relation || extraction.match?.relation,
        project: item.project || extraction.match?.projectName || null,
      },
      job
    )
  );
  return recordRepository.createMany(payloads);
}

async function persistProject({ projectRepository, job, extraction }) {
  const item = extraction.items[0] || extraction.draftItems[0] || {};
  const title = String(item.title || extraction.match?.projectName || "")
    .replace(/^(crea(r)?|nuevo|nueva)\s+(este\s+|un\s+|el\s+)?proyecto\s*/i, "")
    .trim();
  const description = (item.description || "").trim() || null;

  if (!title) {
    throw new Error(
      "No detecté el nombre del proyecto. Prueba: crea el proyecto Qhiro Symbiotic."
    );
  }

  const existing = await projectRepository.findByUserAndTitle(job.user_id, title);
  const project =
    existing ||
    (await projectRepository.create({
      user_id: job.user_id,
      title,
      description,
    }));

  return { project, alreadyExisted: Boolean(existing), description };
}

module.exports = {
  persistCreate,
  persistUpdate,
  persistComplete,
  persistProject,
};
