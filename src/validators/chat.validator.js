const { z } = require("zod");

const chatSchema = z.object({
  body: z.object({
    message: z
      .string({ required_error: "message is required" })
      .trim()
      .min(1, "message cannot be empty")
      .max(4000, "message is too long"),
    userName: z.string().trim().max(80).optional(),
    userEmail: z.string().email().optional().or(z.literal("")),
    context: z
      .object({
        tasks: z.array(z.any()).optional(),
        events: z.array(z.any()).optional(),
        records: z.array(z.any()).optional(),
      })
      .optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

module.exports = {
  chatSchema,
};
