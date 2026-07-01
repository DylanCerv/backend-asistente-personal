const { ALLOWED_AUDIO_MIME_TYPES, RECORD_TYPES } = require("../constants/jobs");
const resourcePaths = require("./openapi-resource-paths");
const authPaths = require("./openapi-auth-paths");
const rolesPaths = require("./openapi-roles-paths");

const audioMimeTypes = ALLOWED_AUDIO_MIME_TYPES.join(", ");

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Personal Assistant API",
    version: "1.0.0",
    description: [
      "Backend asíncrono para procesamiento de audio con IA.",
      "",
      "Flujo: sube audio → recibe `jobId` al instante → consulta estado con polling.",
      "",
      "Autenticación: JWT de Supabase en header `Authorization: Bearer <token>`.",
      "",
      "Roles: `1` Cliente | `2` Administrador. Ver GET /api/roles.",
    ].join("\n"),
    contact: {
      name: "API Support",
    },
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local development",
    },
  ],
  tags: [
    { name: "Roles", description: "Catálogo de roles (IDs numéricos)" },
    { name: "Health", description: "Health check" },
    { name: "Audio", description: "Upload de audio y creación de jobs" },
    { name: "Jobs", description: "Consulta y gestión de jobs asíncronos" },
    { name: "Profiles", description: "Perfil del usuario y gestión admin" },
    { name: "Records", description: "Datos estructurados (tareas, notas, etc.)" },
    { name: "Tags", description: "Etiquetas por usuario" },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        description: "Verifica que la API esté en línea.",
        operationId: "getHealth",
        responses: {
          200: {
            description: "API operativa",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
                example: {
                  success: true,
                  status: "ok",
                  timestamp: "2026-06-30T12:00:00.000Z",
                },
              },
            },
          },
        },
      },
    },
    "/api/audio": {
      post: {
        tags: ["Audio"],
        summary: "Subir audio",
        description: [
          "Recibe un archivo de audio, lo almacena y crea un job en estado `pending`.",
          "Responde inmediatamente sin esperar transcripción ni análisis de IA.",
        ].join(" "),
        operationId: "uploadAudio",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["audio"],
                properties: {
                  audio: {
                    type: "string",
                    format: "binary",
                    description: `Archivo de audio. Formatos: ${audioMimeTypes}`,
                  },
                },
              },
            },
          },
        },
        responses: {
          202: {
            description: "Job creado. Procesamiento en segundo plano.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UploadAudioResponse" },
                example: {
                  success: true,
                  jobId: "550e8400-e29b-41d4-a716-446655440000",
                  status: "pending",
                },
              },
            },
          },
          400: {
            description: "Archivo inválido o formato no soportado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          401: {
            description: "Token ausente o inválido",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/jobs/{jobId}": {
      get: {
        tags: ["Jobs"],
        summary: "Consultar estado del job",
        description: [
          "Devuelve el estado actual, progreso y resultado si ya terminó.",
          "Usar para polling cada 2–3 segundos desde el frontend.",
        ].join(" "),
        operationId: "getJobById",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/jobId" }],
        responses: {
          200: {
            description: "Estado del job",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/JobStatusResponse" },
                examples: {
                  pending: {
                    summary: "En cola",
                    value: {
                      success: true,
                      jobId: "550e8400-e29b-41d4-a716-446655440000",
                      status: "pending",
                      progress: 0,
                      createdAt: "2026-06-30T12:00:00.000Z",
                      updatedAt: "2026-06-30T12:00:00.000Z",
                    },
                  },
                  processing: {
                    summary: "Procesando",
                    value: {
                      success: true,
                      jobId: "550e8400-e29b-41d4-a716-446655440000",
                      status: "processing",
                      progress: 50,
                      createdAt: "2026-06-30T12:00:00.000Z",
                      updatedAt: "2026-06-30T12:00:05.000Z",
                    },
                  },
                  completed: {
                    summary: "Completado",
                    value: {
                      success: true,
                      jobId: "550e8400-e29b-41d4-a716-446655440000",
                      status: "completed",
                      progress: 100,
                      createdAt: "2026-06-30T12:00:00.000Z",
                      updatedAt: "2026-06-30T12:00:15.000Z",
                      result: {
                        transcription: "Recuérdame llamar a Juan mañana a las 10",
                        structuredData: {
                          type: "reminder",
                          title: "Llamar a Juan",
                          priority: "medium",
                          date: "2026-07-01T10:00:00.000Z",
                        },
                        record: {
                          id: "660e8400-e29b-41d4-a716-446655440001",
                          type: "reminder",
                          title: "Llamar a Juan",
                        },
                      },
                    },
                  },
                  failed: {
                    summary: "Fallido",
                    value: {
                      success: true,
                      jobId: "550e8400-e29b-41d4-a716-446655440000",
                      status: "failed",
                      progress: 25,
                      createdAt: "2026-06-30T12:00:00.000Z",
                      updatedAt: "2026-06-30T12:00:10.000Z",
                      error: {
                        message: "OpenAI rate limit exceeded",
                        occurredAt: "2026-06-30T12:00:10.000Z",
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "No autorizado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          404: {
            description: "Job no encontrado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Jobs"],
        summary: "Eliminar job",
        description: "Marca el job como eliminado (soft delete).",
        operationId: "deleteJob",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/jobId" }],
        responses: {
          200: {
            description: "Job eliminado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DeleteJobResponse" },
                example: {
                  success: true,
                  jobId: "550e8400-e29b-41d4-a716-446655440000",
                  deleted: true,
                },
              },
            },
          },
          401: {
            description: "No autorizado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          404: {
            description: "Job no encontrado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/jobs/{jobId}/result": {
      get: {
        tags: ["Jobs"],
        summary: "Obtener resultado final",
        description: "Devuelve únicamente el resultado si el job está en estado `completed`.",
        operationId: "getJobResult",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/jobId" }],
        responses: {
          200: {
            description: "Resultado del job",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/JobResultResponse" },
                example: {
                  success: true,
                  data: {
                    jobId: "550e8400-e29b-41d4-a716-446655440000",
                    transcription: "Crear tarea revisar propuesta del cliente Acme",
                    structuredData: {
                      type: "task",
                      title: "Revisar propuesta",
                      client: "Acme",
                      priority: "high",
                    },
                    record: {
                      id: "660e8400-e29b-41d4-a716-446655440001",
                      type: "task",
                      title: "Revisar propuesta",
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "No autorizado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          404: {
            description: "Job no encontrado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          409: {
            description: "Job aún procesando o fallido",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                examples: {
                  inProgress: {
                    summary: "Aún procesando",
                    value: {
                      success: false,
                      error: {
                        message: "Job is still processing",
                        code: "JOB_IN_PROGRESS",
                      },
                    },
                  },
                  failed: {
                    summary: "Job fallido",
                    value: {
                      success: false,
                      error: {
                        message: "Job failed",
                        code: "JOB_FAILED",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/jobs/{jobId}/retry": {
      post: {
        tags: ["Jobs"],
        summary: "Reintentar job fallido",
        description: "Resetea un job en estado `failed` a `pending` para reprocesarlo.",
        operationId: "retryJob",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/jobId" }],
        responses: {
          200: {
            description: "Job encolado para reintento",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RetryJobResponse" },
                example: {
                  success: true,
                  jobId: "550e8400-e29b-41d4-a716-446655440000",
                  status: "pending",
                },
              },
            },
          },
          401: {
            description: "No autorizado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          404: {
            description: "Job no encontrado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          409: {
            description: "Solo jobs fallidos pueden reintentarse",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  success: false,
                  error: {
                    message: "Only failed jobs can be retried",
                    code: "JOB_NOT_FAILED",
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Supabase access token (`session.access_token`)",
      },
    },
    parameters: {
      jobId: {
        name: "jobId",
        in: "path",
        required: true,
        description: "UUID del job",
        schema: {
          type: "string",
          format: "uuid",
          example: "550e8400-e29b-41d4-a716-446655440000",
        },
      },
    },
    schemas: {
      HealthResponse: {
        type: "object",
        required: ["success", "status", "timestamp"],
        properties: {
          success: { type: "boolean", example: true },
          status: { type: "string", example: "ok" },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      UploadAudioResponse: {
        type: "object",
        required: ["success", "jobId", "status"],
        properties: {
          success: { type: "boolean", example: true },
          jobId: { type: "string", format: "uuid" },
          status: {
            type: "string",
            enum: ["pending"],
            example: "pending",
          },
        },
      },
      JobStatus: {
        type: "string",
        enum: ["pending", "processing", "completed", "failed"],
        description: "Estado del job",
      },
      StructuredData: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: RECORD_TYPES,
          },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          priority: {
            type: "string",
            enum: ["low", "medium", "high"],
            nullable: true,
          },
          date: { type: "string", format: "date-time", nullable: true },
          client: { type: "string", nullable: true },
          project: { type: "string", nullable: true },
          amount: { type: "number", nullable: true },
          currency: { type: "string", nullable: true },
          metadata: { type: "object", additionalProperties: true },
        },
      },
      Record: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          user_id: { type: "string", format: "uuid" },
          job_id: { type: "string", format: "uuid" },
          type: { type: "string", enum: RECORD_TYPES },
          title: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
          priority: {
            type: "string",
            enum: ["low", "medium", "high"],
            nullable: true,
          },
          date: { type: "string", format: "date-time", nullable: true },
          client: { type: "string", nullable: true },
          project: { type: "string", nullable: true },
          amount: { type: "number", nullable: true },
          currency: { type: "string", nullable: true },
          data: { type: "object", additionalProperties: true },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      JobResult: {
        type: "object",
        properties: {
          transcription: { type: "string" },
          structuredData: { $ref: "#/components/schemas/StructuredData" },
          record: { $ref: "#/components/schemas/Record" },
        },
      },
      JobError: {
        type: "object",
        properties: {
          message: { type: "string" },
          occurredAt: { type: "string", format: "date-time" },
        },
      },
      JobStatusResponse: {
        type: "object",
        required: ["success", "jobId", "status", "progress"],
        properties: {
          success: { type: "boolean", example: true },
          jobId: { type: "string", format: "uuid" },
          status: { $ref: "#/components/schemas/JobStatus" },
          progress: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            description: "0=pending, 25=transcribing, 50=analyzing, 75=structuring, 90=saving, 100=done",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          result: { $ref: "#/components/schemas/JobResult" },
          error: { $ref: "#/components/schemas/JobError" },
        },
      },
      JobResultResponse: {
        type: "object",
        required: ["success", "data"],
        properties: {
          success: { type: "boolean", example: true },
          data: {
            type: "object",
            properties: {
              jobId: { type: "string", format: "uuid" },
              transcription: { type: "string" },
              structuredData: { $ref: "#/components/schemas/StructuredData" },
              record: { $ref: "#/components/schemas/Record" },
            },
          },
        },
      },
      RetryJobResponse: {
        type: "object",
        required: ["success", "jobId", "status"],
        properties: {
          success: { type: "boolean", example: true },
          jobId: { type: "string", format: "uuid" },
          status: {
            type: "string",
            enum: ["pending"],
            example: "pending",
          },
        },
      },
      DeleteJobResponse: {
        type: "object",
        required: ["success", "jobId", "deleted"],
        properties: {
          success: { type: "boolean", example: true },
          jobId: { type: "string", format: "uuid" },
          deleted: { type: "boolean", example: true },
        },
      },
      ErrorResponse: {
        type: "object",
        required: ["success", "error"],
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "object",
            required: ["message", "code"],
            properties: {
              message: { type: "string" },
              code: {
                type: "string",
                enum: [
                  "VALIDATION_ERROR",
                  "UNAUTHORIZED",
                  "NOT_FOUND",
                  "JOB_IN_PROGRESS",
                  "JOB_FAILED",
                  "JOB_NOT_FAILED",
                  "CONFLICT",
                  "ROUTE_NOT_FOUND",
                  "FORBIDDEN",
                  "INTERNAL_ERROR",
                ],
              },
              details: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    field: { type: "string" },
                    message: { type: "string" },
                  },
                },
              },
              stack: {
                type: "string",
                description: "Solo en NODE_ENV=development para errores 5xx",
              },
            },
          },
        },
      },
    },
  },
};

openApiSpec.paths = { ...openApiSpec.paths, ...authPaths, ...rolesPaths, ...resourcePaths };

module.exports = openApiSpec;
