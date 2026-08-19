const express = require("express");
const authRoutes = require("./auth.routes");
const audioRoutes = require("./audio.routes");
const chatRoutes = require("./chat.routes");
const feedbackRoutes = require("./feedback.routes");
const jobsRoutes = require("./jobs.routes");
const profilesRoutes = require("./profiles.routes");
const recordsRoutes = require("./records.routes");
const settingsRoutes = require("./settings.routes");
const tagsRoutes = require("./tags.routes");
const projectsRoutes = require("./projects.routes");
const rolesRoutes = require("./roles.routes");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

router.use("/auth", authRoutes);
router.use("/roles", rolesRoutes);
router.use("/audio", audioRoutes);
router.use("/chat", chatRoutes);
router.use("/feedback", feedbackRoutes);
router.use("/jobs", jobsRoutes);
router.use("/profiles", profilesRoutes);
router.use("/records", recordsRoutes);
router.use("/settings", settingsRoutes);
router.use("/tags", tagsRoutes);
router.use("/projects", projectsRoutes);

module.exports = router;
