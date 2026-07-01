const RecordRepository = require("../repositories/record.repository");
const TagRepository = require("../repositories/tag.repository");
const RecordTagRepository = require("../repositories/recordTag.repository");
const {
  NotFoundError,
  ConflictError,
  ValidationError,
} = require("../errors/AppError");
const { assertResourceAccess } = require("../utils/accessControl");

class RecordTagService {
  constructor(
    recordRepository = new RecordRepository(),
    tagRepository = new TagRepository(),
    recordTagRepository = new RecordTagRepository()
  ) {
    this.recordRepository = recordRepository;
    this.tagRepository = tagRepository;
    this.recordTagRepository = recordTagRepository;
  }

  async listByRecord(actor, recordId) {
    const record = await this.recordRepository.findById(recordId);

    if (!record) {
      throw new NotFoundError("Record not found");
    }

    assertResourceAccess(actor, record.user_id);

    return this.recordTagRepository.findByRecordId(recordId);
  }

  async attach(actor, recordId, tagId) {
    if (!tagId) {
      throw new ValidationError("tagId is required");
    }

    const record = await this.recordRepository.findById(recordId);
    if (!record) {
      throw new NotFoundError("Record not found");
    }

    const tag = await this.tagRepository.findById(tagId);
    if (!tag) {
      throw new NotFoundError("Tag not found");
    }

    assertResourceAccess(actor, record.user_id);
    assertResourceAccess(actor, tag.user_id);

    if (record.user_id !== tag.user_id) {
      throw new ValidationError("Record and tag must belong to the same user");
    }

    const existing = await this.recordTagRepository.findLink(recordId, tagId);
    if (existing) {
      throw new ConflictError("Tag already attached to record", "ALREADY_EXISTS");
    }

    return this.recordTagRepository.create({
      record_id: recordId,
      tag_id: tagId,
      user_id: record.user_id,
    });
  }

  async detach(actor, recordId, tagId) {
    const record = await this.recordRepository.findById(recordId);
    if (!record) {
      throw new NotFoundError("Record not found");
    }

    assertResourceAccess(actor, record.user_id);

    const link = await this.recordTagRepository.findLink(recordId, tagId);
    if (!link) {
      throw new NotFoundError("Tag link not found");
    }

    await this.recordTagRepository.delete(recordId, tagId);

    return { recordId, tagId, deleted: true };
  }
}

module.exports = RecordTagService;
