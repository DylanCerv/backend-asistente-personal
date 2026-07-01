const RoleRepository = require("../repositories/role.repository");

class RoleService {
  constructor(roleRepository = new RoleRepository()) {
    this.roleRepository = roleRepository;
  }

  async listRoles() {
    const roles = await this.roleRepository.findAll();
    return roles;
  }
}

module.exports = RoleService;
