const SettingsService = require("../services/settings.service");

class SettingsController {
  constructor(settingsService = new SettingsService()) {
    this.settingsService = settingsService;
  }

  getMe = async (req, res, next) => {
    try {
      const settings = await this.settingsService.getSettings(req.user);
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  };

  updateMe = async (req, res, next) => {
    try {
      const settings = await this.settingsService.updateSettings(
        req.user,
        req.validated.body
      );
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = SettingsController;
