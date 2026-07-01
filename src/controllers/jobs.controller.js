const JobService = require("../services/job.service");

class JobsController {
  constructor(jobService = new JobService()) {
    this.jobService = jobService;
  }

  list = async (req, res, next) => {
    try {
      const { userId, status, limit, offset } = req.validated.query;
      const result = await this.jobService.list(req.user, {
        userId,
        status,
        limit,
        offset,
      });
      res.json({ success: true, data: result.data, count: result.count });
    } catch (error) {
      next(error);
    }
  };

  getJob = async (req, res, next) => {
    try {
      const result = await this.jobService.getJob(req.user, req.params.jobId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  getResult = async (req, res, next) => {
    try {
      const result = await this.jobService.getJobResult(req.user, req.params.jobId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  retry = async (req, res, next) => {
    try {
      const result = await this.jobService.retryJob(req.user, req.params.jobId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req, res, next) => {
    try {
      const result = await this.jobService.deleteJob(req.user, req.params.jobId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = JobsController;
