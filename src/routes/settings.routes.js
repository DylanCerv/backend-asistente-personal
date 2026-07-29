const express = require("express");
const { z } = require("zod");
const SettingsController = require("../controllers/settings.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");

const router = express.Router();
const settingsController = new SettingsController();

const updateSettingsSchema = z.object({
  body: z
    .object({
      language: z.enum(["es", "en"]).optional(),
      push_notifications: z.boolean().optional(),
      reminder_notifications: z.boolean().optional(),
      reminder_alert_style: z.enum(["sound", "vibration", "both"]).optional(),
      reminder_alert_sound: z
        .enum(["system", "kivo_soft", "kivo_clear", "kivo_urgent"])
        .optional(),
      reminder_alert_vibration: z.enum(["normal", "soft", "strong", "alarm"]).optional(),
      auto_send_audio: z.boolean().optional(),
      biometric_lock: z.boolean().optional(),
      preferred_name: z.string().max(80).optional(),
      plan: z.enum(["free", "pro"]).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required",
    }),
});

router.get("/me", authMiddleware, settingsController.getMe);
router.patch(
  "/me",
  authMiddleware,
  validate(updateSettingsSchema),
  settingsController.updateMe
);

module.exports = router;
