const TagRepository = require("../repositories/tag.repository");
const { NotFoundError, ValidationError } = require("../errors/AppError");
const {
  assertResourceAccess,
  resolveListUserId,
  resolveTargetUserId,
} = require("../utils/accessControl");

class TagService {
  constructor(tagRepository = new TagRepository()) {
    this.tagRepository = tagRepository;
  }

  async list(actor, { userId, limit, offset }) {
    const scopedUserId = resolveListUserId(actor, userId);

    return this.tagRepository.findAll({ userId: scopedUserId, limit, offset });
  }

  async getById(actor, tagId) {
    const tag = await this.tagRepository.findById(tagId);

    if (!tag) {
      throw new NotFoundError("Tag not found");
    }

    assertResourceAccess(actor, tag.user_id);

    return tag;
  }

  async create(actor, payload) {
    const userId = resolveTargetUserId(actor, payload.userId);

    return this.tagRepository.create({
      user_id: userId,
      name: payload.name,
      color: payload.color,
    });
  }

  async update(actor, tagId, payload) {
    const tag = await this.tagRepository.findById(tagId);

    if (!tag) {
      throw new NotFoundError("Tag not found");
    }

    assertResourceAccess(actor, tag.user_id);

    const updates = {};
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.color !== undefined) updates.color = payload.color;

    if (Object.keys(updates).length === 0) {
      throw new ValidationError("No valid fields to update");
    }

    return this.tagRepository.update(tagId, updates);
  }

  async remove(actor, tagId) {
    const tag = await this.tagRepository.findById(tagId);

    if (!tag) {
      throw new NotFoundError("Tag not found");
    }

    assertResourceAccess(actor, tag.user_id);

    await this.tagRepository.delete(tagId);

    return { id: tagId, deleted: true };
  }
}

module.exports = TagService;
