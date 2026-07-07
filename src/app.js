const express = require("express");
const cors = require("cors");
const apiRoutes = require("./routes");
const setupSwagger = require("./middlewares/swagger.middleware");
const {
  notFoundHandler,
  errorHandler,
} = require("./middlewares/errorHandler.middleware");
const { env } = require("./config");
const { createLogger } = require("./utils/logger");

const httpLogger = createLogger("http");

function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigin === "*" ? true : env.corsOrigin.split(","),
      credentials: true,
    })
  );

  app.use((req, _res, next) => {
    httpLogger.info(`${req.method} ${req.path}`);
    next();
  });

  app.use(express.json({ limit: "1mb" }));

  setupSwagger(app);

  app.get("/", (req, res) => {
    res.json({
      success: true,
      message: "Personal Assistant API",
      health: "/api/health",
      docs: "/api/docs",
    });
  });

  app.use("/api", apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
