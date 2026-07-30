const ChatService = require("../services/chat.service");

class ChatController {
  constructor(chatService = new ChatService()) {
    this.chatService = chatService;
  }

  chat = async (req, res, next) => {
    try {
      const result = await this.chatService.chat({
        userId: req.user.id,
        message: req.body.message,
        userName: req.body.userName || req.user.profile?.full_name || req.user.email,
        context: req.body.context || {},
      });

      res.status(200).json({
        success: true,
        reply: result.reply,
        data: {
          reply: result.reply,
          records: result.records,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = ChatController;
