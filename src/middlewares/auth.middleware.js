const { getAnonClient } = require("../clients/supabase.client");
const ProfileRepository = require("../repositories/profile.repository");
const { ROLE_IDS } = require("../constants/roles");
const { UnauthorizedError } = require("../errors/AppError");

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedError("Missing or invalid Authorization header");
    }

    const token = authHeader.slice(7);
    const supabase = getAnonClient();

    if (!supabase) {
      throw new UnauthorizedError("Supabase anon key not configured");
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      throw new UnauthorizedError("Invalid or expired token");
    }

    const profileRepository = new ProfileRepository();
    const profile = await profileRepository.findById(data.user.id);

    req.user = {
      id: data.user.id,
      email: data.user.email,
      roleId: profile?.role_id || ROLE_IDS.CLIENT,
      role: profile?.roles || null,
      profile,
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authMiddleware;
