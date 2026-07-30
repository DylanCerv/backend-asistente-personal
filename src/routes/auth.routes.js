const express = require("express");
const AuthController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  socialAuthSchema,
} = require("../validators/auth.validator");

const router = express.Router();
const authController = new AuthController();

router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.post("/google", validate(socialAuthSchema), authController.googleSignIn);
router.post("/apple", validate(socialAuthSchema), authController.appleSignIn);
router.post("/refresh", validate(refreshSchema), authController.refresh);
router.get("/me", authMiddleware, authController.me);
router.post(
  "/change-password",
  authMiddleware,
  validate(changePasswordSchema),
  authController.changePassword
);

module.exports = router;
