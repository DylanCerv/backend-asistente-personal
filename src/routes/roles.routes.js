const express = require("express");
const RolesController = require("../controllers/roles.controller");

const router = express.Router();
const rolesController = new RolesController();

router.get("/", rolesController.list);

module.exports = router;
