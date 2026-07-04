const RecordService = require("../services/record.service");

class RecordsController {
  constructor(recordService = new RecordService()) {
    this.recordService = recordService;
  }

  list = async (req, res, next) => {
    try {
      const { userId, type, limit, offset } = req.validated.query;
      const result = await this.recordService.list(req.user, {
        userId,
        type,
        limit,
        offset,
      });
      res.json({ success: true, data: result.data, count: result.count });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const record = await this.recordService.getById(req.user, req.params.recordId);
      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const body = req.validated.body;
      const record = await this.recordService.create(req.user, {
        userId: body.userId,
        jobId: body.jobId,
        type: body.type,
        title: body.title,
        description: body.description,
        priority: body.priority,
        date: body.date,
        client: body.client,
        project: body.project,
        amount: body.amount,
        currency: body.currency,
        data: body.data,
      });
      res.status(201).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const record = await this.recordService.update(
        req.user,
        req.params.recordId,
        req.validated.body
      );
      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req, res, next) => {
    try {
      const result = await this.recordService.remove(req.user, req.params.recordId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  getHistory = async (req, res, next) => {
    try {
      const history = await this.recordService.getHistory(req.user, req.params.recordId);
      res.json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = RecordsController;
