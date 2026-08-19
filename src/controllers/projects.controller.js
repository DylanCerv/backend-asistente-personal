const ProjectService = require("../services/project.service");

class ProjectsController {
  constructor(projectService = new ProjectService()) {
    this.projectService = projectService;
  }

  list = async (req, res, next) => {
    try {
      const { userId, limit, offset } = req.validated.query;
      const result = await this.projectService.list(req.user, { userId, limit, offset });
      res.json({ success: true, data: result.data, count: result.count });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const project = await this.projectService.getById(req.user, req.params.projectId);
      res.json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const { userId, title, description } = req.validated.body;
      const project = await this.projectService.create(req.user, { userId, title, description });
      res.status(201).json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const project = await this.projectService.update(
        req.user,
        req.params.projectId,
        req.validated.body
      );
      res.json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req, res, next) => {
    try {
      const result = await this.projectService.remove(req.user, req.params.projectId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = ProjectsController;
