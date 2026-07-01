const express = require("express");
const authRoutes = require("./auth.routes");
const audioRoutes = require("./audio.routes");
const jobsRoutes = require("./jobs.routes");
const profilesRoutes = require("./profiles.routes");
const recordsRoutes = require("./records.routes");
const tagsRoutes = require("./tags.routes");
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
router.use("/jobs", jobsRoutes);
router.use("/profiles", profilesRoutes);
router.use("/records", recordsRoutes);
router.use("/tags", tagsRoutes);

module.exports = router;
