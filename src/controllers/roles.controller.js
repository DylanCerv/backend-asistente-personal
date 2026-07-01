const RoleService = require("../services/role.service");

class RolesController {
  constructor(roleService = new RoleService()) {
    this.roleService = roleService;
  }

  list = async (req, res, next) => {
    try {
      const roles = await this.roleService.listRoles();
      res.json({ success: true, data: roles });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = RolesController;
