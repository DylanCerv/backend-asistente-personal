const { RECORD_TYPES } = require("../constants/jobs");

const VALID_PRIORITIES = ["low", "medium", "high"];

function mapItemToRecordPayload(item, job) {
  const metadata = {
    ...(item.metadata || {}),
  };

  if (item.category) {
    metadata.category = item.category;
  }

  return {
    user_id: job.user_id,
    job_id: job.id,
    type: RECORD_TYPES.includes(item.type) ? item.type : "task",
    title: item.title,
    description: item.description ?? null,
    priority: VALID_PRIORITIES.includes(item.priority) ? item.priority : null,
    date: item.date ?? null,
    client: item.client ?? null,
    project: item.project ?? null,
    amount: item.amount ?? null,
    currency: item.currency ?? null,
    data: metadata,
  };
}

function normalizeExtraction(extraction) {
  if (!extraction) {
    return { items: [] };
  }

  if (Array.isArray(extraction.items) && extraction.items.length > 0) {
    return {
      items: extraction.items,
      summary: extraction.summary || null,
    };
  }

  if (extraction.title || extraction.type) {
    return {
      items: [extraction],
      summary: null,
    };
  }

  return { items: [], summary: null };
}

module.exports = {
  mapItemToRecordPayload,
  normalizeExtraction,
};
