const { z } = require("zod");

const uuidSchema = z.string().uuid("Invalid job ID format");

const jobIdParamSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
});

const audioUploadSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

module.exports = {
  jobIdParamSchema,
  audioUploadSchema,
};
