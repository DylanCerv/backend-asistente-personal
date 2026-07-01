const express = require("express");
const RecordsController = require("../controllers/records.controller");
const RecordTagsController = require("../controllers/recordTags.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  recordListQuerySchema,
  recordIdParamSchema,
  createRecordSchema,
  updateRecordSchema,
  attachTagSchema,
  recordTagParamsSchema,
} = require("../validators/resource.validator");

const router = express.Router();
const recordsController = new RecordsController();
const recordTagsController = new RecordTagsController();

router.get(
  "/",
  authMiddleware,
  validate(recordListQuerySchema),
  recordsController.list
);

router.post(
  "/",
  authMiddleware,
  validate(createRecordSchema),
  recordsController.create
);

router.get(
  "/:recordId",
  authMiddleware,
  validate(recordIdParamSchema),
  recordsController.getById
);

router.patch(
  "/:recordId",
  authMiddleware,
  validate(updateRecordSchema),
  recordsController.update
);

router.delete(
  "/:recordId",
  authMiddleware,
  validate(recordIdParamSchema),
  recordsController.remove
);

router.get(
  "/:recordId/tags",
  authMiddleware,
  validate(recordIdParamSchema),
  recordTagsController.list
);

router.post(
  "/:recordId/tags",
  authMiddleware,
  validate(attachTagSchema),
  recordTagsController.attach
);

router.delete(
  "/:recordId/tags/:tagId",
  authMiddleware,
  validate(recordTagParamsSchema),
  recordTagsController.detach
);

module.exports = router;
