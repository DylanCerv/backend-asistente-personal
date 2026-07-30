const express = require("express");
const ChatController = require("../controllers/chat.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { chatSchema } = require("../validators/chat.validator");

const router = express.Router();
const chatController = new ChatController();

router.post("/", authMiddleware, validate(chatSchema), chatController.chat);

module.exports = router;
