const ProfileService = require("../services/profile.service");

class ProfilesController {
  constructor(profileService = new ProfileService()) {
    this.profileService = profileService;
  }

  getMe = async (req, res, next) => {
    try {
      const profile = await this.profileService.getMe(req.user);
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  };

  updateMe = async (req, res, next) => {
    try {
      const { fullName, avatarUrl } = req.validated.body;
      const profile = await this.profileService.updateMe(req.user, {
        full_name: fullName,
        avatar_url: avatarUrl,
      });
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  };

  list = async (req, res, next) => {
    try {
      const { roleId, limit, offset } = req.validated.query;
      const result = await this.profileService.listProfiles(req.user, {
        roleId,
        limit,
        offset,
      });
      res.json({ success: true, data: result.data, count: result.count });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const profile = await this.profileService.getProfileById(
        req.user,
        req.params.profileId
      );
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  };

  updateRole = async (req, res, next) => {
    try {
      const profile = await this.profileService.updateUserRole(
        req.user,
        req.params.profileId,
        req.validated.body.roleId
      );
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = ProfilesController;
