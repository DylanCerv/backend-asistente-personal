const ProjectRepository = require("../repositories/project.repository");
const { NotFoundError, ValidationError } = require("../errors/AppError");
const {
  assertResourceAccess,
  resolveListUserId,
  resolveTargetUserId,
} = require("../utils/accessControl");

class ProjectService {
  constructor(projectRepository = new ProjectRepository()) {
    this.projectRepository = projectRepository;
  }

  async list(actor, { userId, limit, offset }) {
    const scopedUserId = resolveListUserId(actor, userId);
    return this.projectRepository.findAll({ userId: scopedUserId, limit, offset });
  }

  async getById(actor, projectId) {
    const project = await this.projectRepository.findById(projectId);
    if (!project) throw new NotFoundError("Project not found");
    assertResourceAccess(actor, project.user_id);
    return project;
  }

  async create(actor, payload) {
    const userId = resolveTargetUserId(actor, payload.userId);
    const title = String(payload.title || "").trim();
    if (!title) throw new ValidationError("title is required");

    const existing = await this.projectRepository.findByUserAndTitle(userId, title);
    if (existing) {
      throw new ValidationError("Ya tienes un proyecto con ese nombre");
    }

    return this.projectRepository.create({
      user_id: userId,
      title,
      description: payload.description?.trim() || null,
    });
  }

  async update(actor, projectId, payload) {
    const project = await this.getById(actor, projectId);
    const updates = {};
    if (payload.title !== undefined) updates.title = String(payload.title).trim();
    if (payload.description !== undefined) {
      updates.description = payload.description ? String(payload.description).trim() : null;
    }
    if (Object.keys(updates).length === 0) {
      throw new ValidationError("No valid fields to update");
    }
    return this.projectRepository.update(project.id, updates);
  }

  async remove(actor, projectId) {
    const project = await this.getById(actor, projectId);
    await this.projectRepository.delete(project.id);
    return { id: projectId, deleted: true };
  }
}

module.exports = ProjectService;
