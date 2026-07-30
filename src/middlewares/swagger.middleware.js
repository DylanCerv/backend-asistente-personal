const swaggerUi = require("swagger-ui-express");
const openApiSpec = require("../docs/openapi");

const swaggerUiOptions = {
  customSiteTitle: "Personal Assistant API — Swagger",
  customCss: ".swagger-ui .topbar { display: none }",
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
  },
};

function setupSwagger(app) {
  // Hide API docs in production — keeps the schema off the public internet.
  if (process.env.NODE_ENV === "production") {
    return;
  }

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec, swaggerUiOptions));
  app.get("/api/docs.json", (req, res) => {
    res.json(openApiSpec);
  });
}

module.exports = setupSwagger;
