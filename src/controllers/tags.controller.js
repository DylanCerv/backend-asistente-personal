const TagService = require("../services/tag.service");

class TagsController {
  constructor(tagService = new TagService()) {
    this.tagService = tagService;
  }

  list = async (req, res, next) => {
    try {
      const { userId, limit, offset } = req.validated.query;
      const result = await this.tagService.list(req.user, { userId, limit, offset });
      res.json({ success: true, data: result.data, count: result.count });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const tag = await this.tagService.getById(req.user, req.params.tagId);
      res.json({ success: true, data: tag });
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const { userId, name, color } = req.validated.body;
      const tag = await this.tagService.create(req.user, { userId, name, color });
      res.status(201).json({ success: true, data: tag });
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const tag = await this.tagService.update(
        req.user,
        req.params.tagId,
        req.validated.body
      );
      res.json({ success: true, data: tag });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req, res, next) => {
    try {
      const result = await this.tagService.remove(req.user, req.params.tagId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = TagsController;
