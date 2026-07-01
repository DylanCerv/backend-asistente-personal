module.exports = {
  "/api/auth/register": {
    post: {
      tags: ["Auth"],
      summary: "Registrar usuario",
      description: "Crea cuenta con rol `client` por defecto. No requiere token.",
      operationId: "register",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email", "password"],
              properties: {
                email: { type: "string", format: "email" },
                password: { type: "string", minLength: 8 },
                fullName: { type: "string" },
              },
            },
            example: {
              email: "user@example.com",
              password: "securepass123",
              fullName: "Dylan",
            },
          },
        },
      },
      responses: {
        201: { description: "Usuario registrado como client" },
        409: { description: "Email ya registrado" },
      },
    },
  },
  "/api/auth/login": {
    post: {
      tags: ["Auth"],
      summary: "Iniciar sesión",
      operationId: "login",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email", "password"],
              properties: {
                email: { type: "string", format: "email" },
                password: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        200: { description: "Sesión iniciada, devuelve accessToken" },
        401: { description: "Credenciales inválidas" },
      },
    },
  },
  "/api/auth/refresh": {
    post: {
      tags: ["Auth"],
      summary: "Renovar token",
      operationId: "refreshToken",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["refreshToken"],
              properties: {
                refreshToken: { type: "string" },
              },
            },
          },
        },
      },
      responses: { 200: { description: "Nuevo accessToken" } },
    },
  },
  "/api/auth/me": {
    get: {
      tags: ["Auth"],
      summary: "Usuario autenticado actual",
      operationId: "getAuthMe",
      security: [{ bearerAuth: [] }],
      responses: { 200: { description: "Usuario + perfil + rol" } },
    },
  },
};
