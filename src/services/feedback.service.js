const FeedbackRepository = require("../repositories/feedback.repository");
const { ValidationError, ForbiddenError } = require("../errors/AppError");
const { isAdmin } = require("../utils/accessControl");

class FeedbackService {
  constructor(feedbackRepository = new FeedbackRepository()) {
    this.feedbackRepository = feedbackRepository;
  }

  async getMine(actor) {
    return this.feedbackRepository.findByUserId(actor.id);
  }

  async submit(actor, payload) {
    const rating = Number(payload.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ValidationError("rating must be an integer between 1 and 5");
    }

    const comment =
      typeof payload.comment === "string" ? payload.comment.trim().slice(0, 1000) : "";
    const app_version =
      typeof payload.app_version === "string"
        ? payload.app_version.trim().slice(0, 40)
        : "";

    return this.feedbackRepository.upsert(actor.id, {
      rating,
      comment,
      app_version,
    });
  }

  async listAll(actor, query = {}) {
    if (!isAdmin(actor)) {
      throw new ForbiddenError("Insufficient permissions");
    }
    return this.feedbackRepository.listAll({
      limit: query.limit,
      offset: query.offset,
    });
  }
}

module.exports = FeedbackService;
