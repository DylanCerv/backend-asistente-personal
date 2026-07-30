const express = require("express");
const RolesController = require("../controllers/roles.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();
const rolesController = new RolesController();

router.get("/", authMiddleware, rolesController.list);

module.exports = router;
