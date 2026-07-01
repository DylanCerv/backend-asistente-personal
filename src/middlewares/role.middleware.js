const { ROLE_IDS, VALID_ROLE_IDS } = require("../constants/roles");
const { ForbiddenError } = require("../errors/AppError");

function requireRole(...roleIds) {
  return (req, res, next) => {
    if (!req.user?.roleId || !roleIds.includes(req.user.roleId)) {
      return next(new ForbiddenError("Insufficient permissions"));
    }
    next();
  };
}

const requireAdmin = requireRole(ROLE_IDS.ADMIN);

module.exports = {
  requireRole,
  requireAdmin,
  VALID_ROLE_IDS,
};
