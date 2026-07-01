const express = require("express");
const TagsController = require("../controllers/tags.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  paginationQuerySchema,
  tagIdParamSchema,
  createTagSchema,
  updateTagSchema,
} = require("../validators/resource.validator");

const router = express.Router();
const tagsController = new TagsController();

router.get(
  "/",
  authMiddleware,
  validate(paginationQuerySchema),
  tagsController.list
);

router.post(
  "/",
  authMiddleware,
  validate(createTagSchema),
  tagsController.create
);

router.get(
  "/:tagId",
  authMiddleware,
  validate(tagIdParamSchema),
  tagsController.getById
);

router.patch(
  "/:tagId",
  authMiddleware,
  validate(updateTagSchema),
  tagsController.update
);

router.delete(
  "/:tagId",
  authMiddleware,
  validate(tagIdParamSchema),
  tagsController.remove
);

module.exports = router;
