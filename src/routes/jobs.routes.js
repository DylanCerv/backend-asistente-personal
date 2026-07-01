const express = require("express");
const JobsController = require("../controllers/jobs.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  jobListQuerySchema,
  jobIdParamSchema,
} = require("../validators/resource.validator");

const router = express.Router();
const jobsController = new JobsController();

router.get(
  "/",
  authMiddleware,
  validate(jobListQuerySchema),
  jobsController.list
);

router.get(
  "/:jobId",
  authMiddleware,
  validate(jobIdParamSchema),
  jobsController.getJob
);

router.get(
  "/:jobId/result",
  authMiddleware,
  validate(jobIdParamSchema),
  jobsController.getResult
);

router.post(
  "/:jobId/retry",
  authMiddleware,
  validate(jobIdParamSchema),
  jobsController.retry
);

router.delete(
  "/:jobId",
  authMiddleware,
  validate(jobIdParamSchema),
  jobsController.remove
);

module.exports = router;
