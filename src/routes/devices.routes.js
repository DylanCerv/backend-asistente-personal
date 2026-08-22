const express = require("express");
const { z } = require("zod");
const DevicesController = require("../controllers/devices.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");

const router = express.Router();
const devicesController = new DevicesController();

const registerSchema = z.object({
  body: z.object({
    token: z.string().min(10).max(512),
    platform: z.enum(["ios", "android", "web", "unknown"]).optional(),
    deviceId: z.string().max(128).optional().nullable(),
    appVersion: z.string().max(64).optional().nullable(),
  }),
});

const unregisterSchema = z
  .object({
    body: z
      .object({
        token: z.string().min(10).max(512).optional(),
      })
      .optional(),
    query: z
      .object({
        token: z.string().min(10).max(512).optional(),
      })
      .optional(),
  })
  .refine((data) => Boolean(data.body?.token || data.query?.token), {
    message: "token is required",
    path: ["body", "token"],
  });

router.post(
  "/push-token",
  authMiddleware,
  validate(registerSchema),
  devicesController.registerPushToken
);

router.delete(
  "/push-token",
  authMiddleware,
  validate(unregisterSchema),
  devicesController.unregisterPushToken
);

module.exports = router;
