const express = require("express");
const ProjectsController = require("../controllers/projects.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  paginationQuerySchema,
  projectIdParamSchema,
  createProjectSchema,
  updateProjectSchema,
} = require("../validators/resource.validator");

const router = express.Router();
const projectsController = new ProjectsController();

router.get("/", authMiddleware, validate(paginationQuerySchema), projectsController.list);
router.post("/", authMiddleware, validate(createProjectSchema), projectsController.create);
router.get("/:projectId", authMiddleware, validate(projectIdParamSchema), projectsController.getById);
router.patch("/:projectId", authMiddleware, validate(updateProjectSchema), projectsController.update);
router.delete("/:projectId", authMiddleware, validate(projectIdParamSchema), projectsController.remove);

module.exports = router;
