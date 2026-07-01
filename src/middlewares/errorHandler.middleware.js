const { AppError } = require("../errors/AppError");
const { createLogger } = require("../utils/logger");

const logger = createLogger("errorHandler");

function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, "ROUTE_NOT_FOUND"));
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || "INTERNAL_ERROR";

  if (statusCode >= 500) {
    logger.error(err.message, {
      stack: err.stack,
      path: req.originalUrl,
      method: req.method,
    });
  }

  const response = {
    success: false,
    error: {
      message: err.isOperational ? err.message : "Internal server error",
      code,
    },
  };

  if (err.details) {
    response.error.details = err.details;
  }

  if (process.env.NODE_ENV === "development" && statusCode >= 500) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
