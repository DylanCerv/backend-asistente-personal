const RecordRepository = require("../repositories/record.repository");
const { NotFoundError, ValidationError } = require("../errors/AppError");
const {
  assertResourceAccess,
  resolveListUserId,
  resolveTargetUserId,
} = require("../utils/accessControl");

class RecordService {
  constructor(recordRepository = new RecordRepository()) {
    this.recordRepository = recordRepository;
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

    return this.recordRepository.create({
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

    return this.recordRepository.update(recordId, updates);
  }

  async remove(actor, recordId) {
    const record = await this.recordRepository.findById(recordId);

    if (!record) {
      throw new NotFoundError("Record not found");
    }

    assertResourceAccess(actor, record.user_id);

    await this.recordRepository.delete(recordId);

    return { id: recordId, deleted: true };
  }
}

module.exports = RecordService;
