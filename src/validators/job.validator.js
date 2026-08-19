const { z } = require("zod");

const uuidSchema = z.string().uuid("Invalid job ID format");

const jobIdParamSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
});

const audioUploadSchema = z.object({
  body: z
    .object({
      timeZone: z.string().trim().max(64).optional(),
    })
    .passthrough()
    .optional(),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const textProcessSchema = z.object({
  body: z.object({
    text: z
      .string({ required_error: "text is required" })
      .trim()
      .min(1, "text cannot be empty")
      .max(8000, "text is too long"),
    timeZone: z.string().trim().max(64).optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

module.exports = {
  jobIdParamSchema,
  audioUploadSchema,
  textProcessSchema,
};
