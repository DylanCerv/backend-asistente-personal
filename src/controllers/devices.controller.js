const DevicesService = require("../services/devices.service");

class DevicesController {
  constructor(devicesService = new DevicesService()) {
    this.devicesService = devicesService;
  }

  registerPushToken = async (req, res, next) => {
    try {
      const data = await this.devicesService.registerPushToken(req.user, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  unregisterPushToken = async (req, res, next) => {
    try {
      const token =
        req.validated?.body?.token ||
        req.validated?.query?.token ||
        req.body?.token ||
        req.query?.token;
      const data = await this.devicesService.unregisterPushToken(req.user, token);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = DevicesController;
