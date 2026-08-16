const FeedbackService = require("../services/feedback.service");

class FeedbackController {
  constructor(feedbackService = new FeedbackService()) {
    this.feedbackService = feedbackService;
  }

  getMe = async (req, res, next) => {
    try {
      const feedback = await this.feedbackService.getMine(req.user);
      res.json({ success: true, data: feedback });
    } catch (error) {
      next(error);
    }
  };

  submit = async (req, res, next) => {
    try {
      const feedback = await this.feedbackService.submit(req.user, req.validated.body);
      res.status(201).json({ success: true, data: feedback });
    } catch (error) {
      next(error);
    }
  };

  list = async (req, res, next) => {
    try {
      const items = await this.feedbackService.listAll(req.user, req.validated?.query ?? req.query);
      res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = FeedbackController;
