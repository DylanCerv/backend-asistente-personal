module.exports = {
  "/api/jobs": {
    get: {
      tags: ["Jobs"],
      summary: "Listar jobs",
      description: "Client: solo los suyos. Admin: todos, filtro opcional `userId`.",
      operationId: "listJobs",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "userId", in: "query", schema: { type: "string", format: "uuid" } },
        { name: "status", in: "query", schema: { type: "string", enum: ["pending", "processing", "completed", "failed"] } },
        { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
      ],
      responses: {
        200: { description: "Lista de jobs" },
        403: { description: "Sin permiso", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      },
    },
  },
  "/api/profiles/me": {
    get: {
      tags: ["Profiles"],
      summary: "Obtener mi perfil",
      operationId: "getMyProfile",
      security: [{ bearerAuth: [] }],
      responses: { 200: { description: "Perfil del usuario autenticado" } },
    },
    patch: {
      tags: ["Profiles"],
      summary: "Actualizar mi perfil",
      operationId: "updateMyProfile",
      security: [{ bearerAuth: [] }],
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                fullName: { type: "string" },
                avatarUrl: { type: "string", nullable: true },
              },
            },
          },
        },
      },
      responses: { 200: { description: "Perfil actualizado" } },
    },
  },
  "/api/profiles": {
    get: {
      tags: ["Profiles"],
      summary: "Listar perfiles (admin)",
      operationId: "listProfiles",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "roleId", in: "query", schema: { type: "integer", enum: [1, 2] } },
        { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
      ],
      responses: {
        200: { description: "Lista de perfiles" },
        403: { description: "Admin requerido" },
      },
    },
  },
  "/api/profiles/{profileId}/role": {
    patch: {
      tags: ["Profiles"],
      summary: "Cambiar rol de usuario (admin)",
      operationId: "updateUserRole",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "profileId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["roleId"],
              properties: { roleId: { type: "integer", enum: [1, 2], description: "1=Cliente, 2=Administrador" } },
            },
          },
        },
      },
      responses: { 200: { description: "Rol actualizado" }, 403: { description: "Admin requerido" } },
    },
  },
  "/api/records": {
    get: {
      tags: ["Records"],
      summary: "Listar records",
      operationId: "listRecords",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "userId", in: "query", schema: { type: "string", format: "uuid" } },
        { name: "type", in: "query", schema: { type: "string" } },
        { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
      ],
      responses: { 200: { description: "Lista de records" }, 403: { description: "Sin permiso" } },
    },
    post: {
      tags: ["Records"],
      summary: "Crear record",
      operationId: "createRecord",
      security: [{ bearerAuth: [] }],
      responses: { 201: { description: "Record creado" }, 403: { description: "Sin permiso" } },
    },
  },
  "/api/records/{recordId}": {
    get: {
      tags: ["Records"],
      summary: "Obtener record",
      operationId: "getRecord",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "recordId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: { 200: { description: "Record" }, 403: { description: "Sin permiso" }, 404: { description: "No encontrado" } },
    },
    patch: {
      tags: ["Records"],
      summary: "Actualizar record",
      operationId: "updateRecord",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "recordId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: { 200: { description: "Actualizado" } },
    },
    delete: {
      tags: ["Records"],
      summary: "Eliminar record",
      operationId: "deleteRecord",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "recordId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: { 200: { description: "Eliminado" } },
    },
  },
  "/api/records/{recordId}/tags": {
    get: {
      tags: ["Tags"],
      summary: "Tags de un record",
      operationId: "listRecordTags",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "recordId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: { 200: { description: "Tags del record" } },
    },
    post: {
      tags: ["Tags"],
      summary: "Asociar tag a record",
      operationId: "attachTagToRecord",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "recordId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["tagId"],
              properties: { tagId: { type: "string", format: "uuid" } },
            },
          },
        },
      },
      responses: { 201: { description: "Tag asociado" } },
    },
  },
  "/api/records/{recordId}/tags/{tagId}": {
    delete: {
      tags: ["Tags"],
      summary: "Quitar tag de record",
      operationId: "detachTagFromRecord",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "recordId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        { name: "tagId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      ],
      responses: { 200: { description: "Tag desasociado" } },
    },
  },
  "/api/tags": {
    get: {
      tags: ["Tags"],
      summary: "Listar tags",
      operationId: "listTags",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "userId", in: "query", schema: { type: "string", format: "uuid" } },
        { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
      ],
      responses: { 200: { description: "Lista de tags" } },
    },
    post: {
      tags: ["Tags"],
      summary: "Crear tag",
      operationId: "createTag",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name"],
              properties: {
                name: { type: "string" },
                color: { type: "string", example: "#6366f1" },
              },
            },
          },
        },
      },
      responses: { 201: { description: "Tag creado" } },
    },
  },
  "/api/tags/{tagId}": {
    get: {
      tags: ["Tags"],
      summary: "Obtener tag",
      operationId: "getTag",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "tagId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: { 200: { description: "Tag" } },
    },
    patch: {
      tags: ["Tags"],
      summary: "Actualizar tag",
      operationId: "updateTag",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "tagId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: { 200: { description: "Tag actualizado" } },
    },
    delete: {
      tags: ["Tags"],
      summary: "Eliminar tag",
      operationId: "deleteTag",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "tagId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: { 200: { description: "Tag eliminado" } },
    },
  },
};
