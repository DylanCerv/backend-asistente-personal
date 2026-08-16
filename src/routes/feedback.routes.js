const express = require("express");
const { z } = require("zod");
const FeedbackController = require("../controllers/feedback.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireAdmin } = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");

const router = express.Router();
const feedbackController = new FeedbackController();

const submitFeedbackSchema = z.object({
  body: z.object({
    rating: z.coerce.number().int().min(1).max(5),
    comment: z.string().max(1000).optional().default(""),
    app_version: z.string().max(40).optional().default(""),
  }),
});

const listFeedbackSchema = z.object({
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    })
    .optional()
    .default({}),
});

router.get("/me", authMiddleware, feedbackController.getMe);
router.post(
  "/",
  authMiddleware,
  validate(submitFeedbackSchema),
  feedbackController.submit
);
router.get(
  "/",
  authMiddleware,
  requireAdmin,
  validate(listFeedbackSchema),
  feedbackController.list
);

module.exports = router;
