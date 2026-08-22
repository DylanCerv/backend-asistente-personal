/**
 * Apply process timezone before any Date-based scheduling.
 * Must be required as the first line of server/worker entrypoints.
 */
require("dotenv").config();

const timezone = process.env.DEFAULT_TIMEZONE || "America/Guayaquil";
process.env.TZ = timezone;

module.exports = { timezone };
