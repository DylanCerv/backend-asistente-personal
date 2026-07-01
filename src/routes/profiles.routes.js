const express = require("express");
const ProfilesController = require("../controllers/profiles.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireAdmin } = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  profileListQuerySchema,
  profileIdParamSchema,
  updateProfileSchema,
  updateRoleSchema,
} = require("../validators/resource.validator");

const router = express.Router();
const profilesController = new ProfilesController();

router.get("/me", authMiddleware, profilesController.getMe);
router.patch(
  "/me",
  authMiddleware,
  validate(updateProfileSchema),
  profilesController.updateMe
);

router.get(
  "/",
  authMiddleware,
  requireAdmin,
  validate(profileListQuerySchema),
  profilesController.list
);

router.get(
  "/:profileId",
  authMiddleware,
  validate(profileIdParamSchema),
  profilesController.getById
);

router.patch(
  "/:profileId/role",
  authMiddleware,
  requireAdmin,
  validate(updateRoleSchema),
  profilesController.updateRole
);

module.exports = router;
