function readRequestTimeZone(req) {
  const header = req?.headers?.["x-timezone"] || req?.headers?.["X-Timezone"];
  const body = req?.body?.timeZone || req?.body?.timezone;
  const value = body || header;
  return typeof value === "string" ? value.trim() : null;
}

module.exports = { readRequestTimeZone };
