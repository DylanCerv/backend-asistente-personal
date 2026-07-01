const ProfileRepository = require("../repositories/profile.repository");
const RoleRepository = require("../repositories/role.repository");
const { ROLE_IDS, isValidRoleId } = require("../constants/roles");
const {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} = require("../errors/AppError");
const {
  isAdmin,
  assertResourceAccess,
} = require("../utils/accessControl");

class ProfileService {
  constructor(
    profileRepository = new ProfileRepository(),
    roleRepository = new RoleRepository()
  ) {
    this.profileRepository = profileRepository;
    this.roleRepository = roleRepository;
  }

  async getMe(actor) {
    const profile = await this.profileRepository.findById(actor.id);

    if (!profile) {
      throw new NotFoundError("Profile not found");
    }

    return profile;
  }

  async updateMe(actor, payload) {
    const allowed = ["full_name", "avatar_url"];
    const updates = {};

    for (const key of allowed) {
      if (payload[key] !== undefined) {
        updates[key] = payload[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      throw new ValidationError("No valid fields to update");
    }

    return this.profileRepository.update(actor.id, updates);
  }

  async listProfiles(actor, { roleId, limit, offset }) {
    if (!isAdmin(actor)) {
      throw new ForbiddenError("Admin access required");
    }

    return this.profileRepository.findAll({ roleId, limit, offset });
  }

  async getProfileById(actor, profileId) {
    const profile = await this.profileRepository.findById(profileId);

    if (!profile) {
      throw new NotFoundError("Profile not found");
    }

    assertResourceAccess(actor, profile.id);

    return profile;
  }

  async updateUserRole(actor, profileId, roleId) {
    if (!isAdmin(actor)) {
      throw new ForbiddenError("Admin access required");
    }

    if (!isValidRoleId(roleId)) {
      throw new ValidationError("Invalid roleId");
    }

    if (profileId === actor.id && roleId !== ROLE_IDS.ADMIN) {
      throw new ForbiddenError("You cannot demote your own admin role");
    }

    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new NotFoundError("Role not found");
    }

    const profile = await this.profileRepository.findById(profileId);
    if (!profile) {
      throw new NotFoundError("Profile not found");
    }

    return this.profileRepository.update(profileId, { role_id: roleId });
  }
}

module.exports = ProfileService;
