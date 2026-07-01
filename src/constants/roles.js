const ROLE_IDS = {
  CLIENT: 1,
  ADMIN: 2,
};

const VALID_ROLE_IDS = Object.values(ROLE_IDS);

function isValidRoleId(roleId) {
  return VALID_ROLE_IDS.includes(roleId);
}

module.exports = {
  ROLE_IDS,
  VALID_ROLE_IDS,
  isValidRoleId,
};
