function isMockAuthEnabled() {
  return process.env.DEV_MOCK_AUTH === "true";
}

module.exports = {
  isMockAuthEnabled,
};
