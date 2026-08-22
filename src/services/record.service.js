const RecordRepository = require("../repositories/record.repository");
const RecordChangeRepository = require("../repositories/record-change.repository");
const NotificationScheduleService = require("./notificationSchedule.service");
const { NotFoundError, ValidationError } = require("../errors/AppError");
const {
  assertResourceAccess,
  resolveListUserId,
  resolveTargetUserId,
} = require("../utils/accessControl");
const { createLogger } = require("../utils/logger");

const logger = createLogger("recordService");

class RecordService {
  constructor(
    recordRepository = new RecordRepository(),
    recordChangeRepository = new RecordChangeRepository(),
    notificationScheduleService = new NotificationScheduleService()
  ) {
    this.recordRepository = recordRepository;
    this.recordChangeRepository = recordChangeRepository;
    this.notificationScheduleService = notificationScheduleService;
  }

  async rebuildNotifications(userId) {
    try {
      await this.notificationScheduleService.rebuildForUser(userId);
    } catch (error) {
      logger.warn("Notification schedule rebuild skipped", {
        userId,
        error: error.message,
      });
    }
  }

  async list(actor, { userId, type, limit, offset }) {
    const scopedUserId = resolveListUserId(actor, userId);

    return this.recordRepository.findAll({
      userId: scopedUserId,
      type,
      limit,
      offset,
    });
  }

  async getById(actor, recordId) {
    const record = await this.recordRepository.findById(recordId);

    if (!record) {
      throw new NotFoundError("Record not found");
    }

    assertResourceAccess(actor, record.user_id);

    return record;
  }

  async create(actor, payload) {
    const userId = resolveTargetUserId(actor, payload.userId);

    const record = await this.recordRepository.create({
      user_id: userId,
      job_id: payload.jobId || null,
      type: payload.type,
      title: payload.title,
      description: payload.description,
      priority: payload.priority,
      date: payload.date,
      client: payload.client,
      project: payload.project,
      amount: payload.amount,
      currency: payload.currency,
      data: payload.data || {},
    });

    await this.rebuildNotifications(userId);
    return record;
  }

  async update(actor, recordId, payload) {
    const record = await this.recordRepository.findById(recordId);

    if (!record) {
      throw new NotFoundError("Record not found");
    }

    assertResourceAccess(actor, record.user_id);

    const allowed = [
      "type",
      "title",
      "description",
      "priority",
      "date",
      "client",
      "project",
      "amount",
      "currency",
      "data",
    ];

    const updates = {};
    for (const key of allowed) {
      if (payload[key] !== undefined) {
        updates[key] = payload[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      throw new ValidationError("No valid fields to update");
    }

    if (updates.data !== undefined) {
      updates.data = { ...(record.data ?? {}), ...updates.data };
    }

    await this.recordChangeRepository.create({
      recordId,
      userId: actor.id,
      previousData: {
        title: record.title,
        description: record.description,
        priority: record.priority,
        date: record.date,
        type: record.type,
        data: record.data,
      },
      changeNote: payload.note || null,
    });

    const updated = await this.recordRepository.update(recordId, updates);
    await this.rebuildNotifications(record.user_id);
    return updated;
  }

  async getHistory(actor, recordId) {
    const record = await this.recordRepository.findById(recordId);

    if (!record) {
      throw new NotFoundError("Record not found");
    }

    assertResourceAccess(actor, record.user_id);

    return this.recordChangeRepository.findByRecordId(recordId);
  }

  async remove(actor, recordId) {
    const record = await this.recordRepository.findById(recordId);

    if (!record) {
      throw new NotFoundError("Record not found");
    }

    assertResourceAccess(actor, record.user_id);

    await this.recordRepository.delete(recordId);
    await this.rebuildNotifications(record.user_id);

    return { id: recordId, deleted: true };
  }
}

module.exports = RecordService;
