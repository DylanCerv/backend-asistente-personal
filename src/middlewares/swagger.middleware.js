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
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec, swaggerUiOptions));
  app.get("/api/docs.json", (req, res) => {
    res.json(openApiSpec);
  });
}

module.exports = setupSwagger;
