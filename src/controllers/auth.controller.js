const AuthService = require("../services/auth.service");
const { AuthMockService } = require("../services/auth.mock.service");
const { isMockAuthEnabled } = require("../utils/mock-auth");

function createAuthService() {
  return isMockAuthEnabled() ? new AuthMockService() : new AuthService();
}

class AuthController {
  constructor(authService = createAuthService()) {
    this.authService = authService;
  }

  register = async (req, res, next) => {
    try {
      const { email, password, fullName } = req.validated.body;
      const result = await this.authService.register({ email, password, fullName });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req, res, next) => {
    try {
      const { email, password } = req.validated.body;
      const result = await this.authService.login({ email, password });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req, res, next) => {
    try {
      const { refreshToken } = req.validated.body;
      const result = await this.authService.refresh({ refreshToken });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  me = async (req, res, next) => {
    try {
      const result = await this.authService.getMe(req.user);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = AuthController;
