const { z } = require("zod");
const { RECORD_TYPES } = require("../constants/jobs");
const { VALID_ROLE_IDS } = require("../constants/roles");

const uuidSchema = z.string().uuid("Invalid ID format");

const paginationQuerySchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
    userId: uuidSchema.optional(),
  }),
});

const jobListQuerySchema = z.object({
  query: paginationQuerySchema.shape.query.extend({
    status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
  }),
});

const recordListQuerySchema = z.object({
  query: paginationQuerySchema.shape.query.extend({
    type: z.enum(RECORD_TYPES).optional(),
  }),
});

const profileListQuerySchema = z.object({
  query: paginationQuerySchema.shape.query.extend({
    roleId: z.coerce.number().int().refine((v) => VALID_ROLE_IDS.includes(v), {
      message: "Invalid roleId",
    }).optional(),
  }),
});

const jobIdParamSchema = z.object({
  params: z.object({ jobId: uuidSchema }),
});

const recordIdParamSchema = z.object({
  params: z.object({ recordId: uuidSchema }),
});

const tagIdParamSchema = z.object({
  params: z.object({ tagId: uuidSchema }),
});

const projectIdParamSchema = z.object({
  params: z.object({ projectId: uuidSchema }),
});

const profileIdParamSchema = z.object({
  params: z.object({ profileId: uuidSchema }),
});

const recordTagParamsSchema = z.object({
  params: z.object({
    recordId: uuidSchema,
    tagId: uuidSchema,
  }),
});

const updateProfileSchema = z.object({
  body: z
    .object({
      fullName: z.string().min(1).max(120).optional(),
      avatarUrl: z.string().url().optional().nullable(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required",
    }),
});

const updateRoleSchema = z.object({
  params: z.object({ profileId: uuidSchema }),
  body: z.object({
    roleId: z.number().int().refine((v) => VALID_ROLE_IDS.includes(v), {
      message: "Invalid roleId. Use GET /api/roles for valid IDs.",
    }),
  }),
});

const createRecordSchema = z.object({
  body: z.object({
    userId: uuidSchema.optional(),
    jobId: uuidSchema.optional().nullable(),
    type: z.enum(RECORD_TYPES),
    title: z.string().max(500).optional().nullable(),
    description: z.string().max(5000).optional().nullable(),
    priority: z.enum(["low", "medium", "high"]).optional().nullable(),
    date: z.string().datetime({ offset: true }).optional().nullable(),
    client: z.string().max(200).optional().nullable(),
    project: z.string().max(200).optional().nullable(),
    amount: z.number().optional().nullable(),
    currency: z.string().max(10).optional().nullable(),
    data: z.record(z.unknown()).optional(),
  }),
});

const updateRecordSchema = z.object({
  params: z.object({ recordId: uuidSchema }),
  body: z
    .object({
      type: z.enum(RECORD_TYPES).optional(),
      title: z.string().max(500).optional().nullable(),
      description: z.string().max(5000).optional().nullable(),
      priority: z.enum(["low", "medium", "high"]).optional().nullable(),
      date: z.string().datetime({ offset: true }).optional().nullable(),
      client: z.string().max(200).optional().nullable(),
      project: z.string().max(200).optional().nullable(),
      amount: z.number().optional().nullable(),
      currency: z.string().max(10).optional().nullable(),
      data: z.record(z.unknown()).optional(),
      note: z.string().max(1000).optional().nullable(),
    })
    .refine((body) => {
      const { note: _note, ...rest } = body;
      return Object.keys(rest).length > 0;
    }, { message: "At least one field is required" }),
});

const createTagSchema = z.object({
  body: z.object({
    userId: uuidSchema.optional(),
    name: z.string().min(1).max(80),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be hex format #RRGGBB")
      .optional(),
  }),
});

const updateTagSchema = z.object({
  params: z.object({ tagId: uuidSchema }),
  body: z
    .object({
      name: z.string().min(1).max(80).optional(),
      color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required",
    }),
});

const attachTagSchema = z.object({
  params: z.object({ recordId: uuidSchema }),
  body: z.object({ tagId: uuidSchema }),
});

const createProjectSchema = z.object({
  body: z.object({
    userId: uuidSchema.optional(),
    title: z.string().min(1).max(120),
    description: z.string().max(2000).optional().nullable(),
  }),
});

const updateProjectSchema = z.object({
  params: z.object({ projectId: uuidSchema }),
  body: z
    .object({
      title: z.string().min(1).max(120).optional(),
      description: z.string().max(2000).optional().nullable(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required",
    }),
});

module.exports = {
  paginationQuerySchema,
  jobListQuerySchema,
  recordListQuerySchema,
  profileListQuerySchema,
  jobIdParamSchema,
  recordIdParamSchema,
  tagIdParamSchema,
  profileIdParamSchema,
  recordTagParamsSchema,
  updateProfileSchema,
  updateRoleSchema,
  createRecordSchema,
  updateRecordSchema,
  createTagSchema,
  updateTagSchema,
  attachTagSchema,
  projectIdParamSchema,
  createProjectSchema,
  updateProjectSchema,
};
