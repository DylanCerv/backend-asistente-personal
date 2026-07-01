const { ROLE_IDS } = require("../constants/roles");
const { ForbiddenError } = require("../errors/AppError");

function isAdmin(actor) {
  return actor?.roleId === ROLE_IDS.ADMIN;
}

function assertResourceAccess(actor, resourceUserId) {
  if (isAdmin(actor)) {
    return;
  }

  if (!actor?.id || actor.id !== resourceUserId) {
    throw new ForbiddenError("You cannot access another user's data");
  }
}

function resolveListUserId(actor, queryUserId) {
  if (isAdmin(actor)) {
    return queryUserId || null;
  }

  if (queryUserId && queryUserId !== actor.id) {
    throw new ForbiddenError("You cannot access another user's data");
  }

  return actor.id;
}

function resolveTargetUserId(actor, bodyUserId) {
  if (isAdmin(actor)) {
    return bodyUserId || actor.id;
  }

  if (bodyUserId && bodyUserId !== actor.id) {
    throw new ForbiddenError("You cannot create data for another user");
  }

  return actor.id;
}

module.exports = {
  isAdmin,
  assertResourceAccess,
  resolveListUserId,
  resolveTargetUserId,
};
