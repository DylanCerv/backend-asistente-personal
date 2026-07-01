const RecordTagService = require("../services/recordTag.service");

class RecordTagsController {
  constructor(recordTagService = new RecordTagService()) {
    this.recordTagService = recordTagService;
  }

  list = async (req, res, next) => {
    try {
      const data = await this.recordTagService.listByRecord(
        req.user,
        req.params.recordId
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  attach = async (req, res, next) => {
    try {
      const link = await this.recordTagService.attach(
        req.user,
        req.params.recordId,
        req.validated.body.tagId
      );
      res.status(201).json({ success: true, data: link });
    } catch (error) {
      next(error);
    }
  };

  detach = async (req, res, next) => {
    try {
      const result = await this.recordTagService.detach(
        req.user,
        req.params.recordId,
        req.params.tagId
      );
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = RecordTagsController;
