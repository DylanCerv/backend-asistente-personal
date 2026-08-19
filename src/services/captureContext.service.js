const { getTimezoneContext } = require("../utils/dateContext");
const { foldText, tokenize, containsFold, titleSimilarity } = require("../utils/textFold");
const { looksLikeCompletion } = require("../utils/captureComplete");

const MAX_TASKS = 20;
const FETCH_LIMIT = 80;
const PROJECT_TASK_CAP = 12;
const RECENT_CAP = 5;

function recordStatus(record) {
  const status = record?.data?.status;
  return status === "completed" ? "completed" : "pending";
}

function isOpenRecord(record) {
  return recordStatus(record) !== "completed";
}

function projectAliases(name) {
  const folded = foldText(name);
  const tokens = folded.split(" ").filter(Boolean);
  const aliases = new Set([name]);
  if (tokens[0] && tokens[0].length >= 4) {
    aliases.add(tokens[0]);
    const softened = tokens[0].replace(/qh/g, "qu");
    if (softened !== tokens[0]) aliases.add(softened);
  }
  return Array.from(aliases);
}

function aggregateProjects(records) {
  const byFold = new Map();

  for (const record of records) {
    const name = typeof record.project === "string" ? record.project.trim() : "";
    if (!name) continue;

    const key = foldText(name);
    if (!key) continue;

    const existing = byFold.get(key);
    if (existing) {
      existing.openCount += isOpenRecord(record) ? 1 : 0;
      continue;
    }

    byFold.set(key, {
      name,
      aliases: projectAliases(name),
      openCount: isOpenRecord(record) ? 1 : 0,
    });
  }

  return Array.from(byFold.values());
}

function matchProjectsFromText(text, projects) {
  const folded = foldText(text);
  if (!folded) return [];

  const hits = [];
  for (const project of projects) {
    const names = [project.name, ...(project.aliases || [])];
    if (names.some((alias) => containsFold(text, alias) || folded.includes(foldText(alias)))) {
      hits.push(project);
    }
  }

  return hits;
}

function compactTask(record) {
  return {
    id: record.id,
    title: record.title || "",
    project: record.project || null,
    date: record.date || null,
    status: recordStatus(record),
    updatedAt: record.updated_at,
  };
}

function pickRelevantTasks(records, text, projectHits, clock = null) {
  const open = records.filter(isOpenRecord);
  const selected = new Map();

  const add = (record) => {
    if (!record || selected.has(record.id) || selected.size >= MAX_TASKS) return;
    selected.set(record.id, compactTask(record));
  };

  if (looksLikeCompletion(text) && clock?.todayYmd) {
    open
      .filter((record) => record.date && String(record.date).startsWith(clock.todayYmd))
      .forEach(add);
  }

  const hitNames = new Set(projectHits.map((project) => foldText(project.name)));
  const fromProjects = open.filter((record) => foldText(record.project || "") && hitNames.has(foldText(record.project)));
  fromProjects.slice(0, PROJECT_TASK_CAP).forEach(add);

  const keywords = tokenize(text);
  if (keywords.length) {
    const scored = open
      .map((record) => ({
        record,
        score:
          titleSimilarity(text, record.title) +
          keywords.reduce((sum, word) => sum + (containsFold(record.title, word) ? 0.15 : 0), 0),
      }))
      .filter((entry) => entry.score >= 0.2)
      .sort((a, b) => b.score - a.score);

    for (const entry of scored) add(entry.record);
  }

  open.slice(0, RECENT_CAP).forEach(add);

  if (selected.size < 8) {
    open.slice(0, 8).forEach(add);
  }

  return Array.from(selected.values()).slice(0, MAX_TASKS);
}

function formatCompactContext(compact) {
  const projectLines = compact.projects.length
    ? compact.projects
        .map(
          (project) =>
            `  - "${project.name}"${
              project.aliases.length > 1 ? ` (alias: ${project.aliases.slice(1).join(", ")})` : ""
            }${project.description ? ` | ${String(project.description).slice(0, 80)}` : ""} | abiertas: ${project.openCount}`
        )
        .join("\n")
    : "  - (ninguno)";

  const taskLines = compact.tasks.length
    ? compact.tasks
        .map(
          (task) =>
            `  - [${task.id}] "${task.title}" | project: ${task.project || "null"} | date: ${
              task.date || "null"
            } | ${task.status}`
        )
        .join("\n")
    : "  - (ninguna)";

  return [
    `Hoy calendario: ${compact.clock.todayYmd}`,
    `Ahora: ${compact.clock.nowFormatted} (${compact.clock.nowLocalIso}) zona ${compact.clock.timeZone} offset ${compact.clock.utcOffset}`,
    "Proyectos del usuario (SOLO estos existen; no inventes otros):",
    projectLines,
    "Tareas abiertas relevantes (máx 20):",
    taskLines,
  ].join("\n");
}

class CaptureContextService {
  constructor(recordRepository, projectRepository = null) {
    this.recordRepository = recordRepository;
    this.projectRepository = projectRepository;
  }

  async build(userId, text, timeZone) {
    const clock = getTimezoneContext(timeZone);
    const records = userId
      ? await this.recordRepository.findRecentByUser(userId, { limit: FETCH_LIMIT })
      : [];

    let catalog = [];
    if (userId && this.projectRepository) {
      const listed = await this.projectRepository.findAll({ userId, limit: 50, offset: 0 });
      catalog = listed.data || [];
    }

    const fromRecords = aggregateProjects(records);
    const countByFold = new Map(fromRecords.map((project) => [foldText(project.name), project.openCount]));
    const projects = catalog.map((row) => ({
      name: row.title,
      description: row.description || null,
      aliases: projectAliases(row.title),
      openCount: countByFold.get(foldText(row.title)) || 0,
    }));

    const projectHits = matchProjectsFromText(text, projects);
    const tasks = pickRelevantTasks(records, text, projectHits, clock);

    return {
      clock,
      projects,
      projectHits,
      tasks,
      records,
    };
  }
}

module.exports = {
  CaptureContextService,
  aggregateProjects,
  matchProjectsFromText,
  pickRelevantTasks,
  formatCompactContext,
  compactTask,
};
