const crypto = require("crypto");

const { ROLE_IDS } = require("../constants/roles");
const {
  ConflictError,
  UnauthorizedError,
  ValidationError,
} = require("../errors/AppError");

const usersByEmail = new Map();
const usersById = new Map();

const MOCK_TOKEN_PREFIX = "mock_";
const MOCK_REFRESH_PREFIX = "mock_refresh_";
const SESSION_TTL_SECONDS = 3600;

function createUserId() {
  return crypto.randomUUID();
}

function encodeTokenPayload(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeTokenPayload(token, prefix) {
  if (!token.startsWith(prefix)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(token.slice(prefix.length), "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function createSession(userId, email) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = { sub: userId, email, exp: expiresAt };

  return {
    accessToken: `${MOCK_TOKEN_PREFIX}${encodeTokenPayload(payload)}`,
    refreshToken: `${MOCK_REFRESH_PREFIX}${encodeTokenPayload({ sub: userId, email, exp: expiresAt })}`,
    expiresAt,
    expiresIn: SESSION_TTL_SECONDS,
  };
}

function formatUser(user) {
  return {
    id: user.id,
    email: user.email,
    roleId: ROLE_IDS.CLIENT,
    role: { id: ROLE_IDS.CLIENT, name: "Cliente" },
    profile: {
      full_name: user.fullName,
      fullName: user.fullName,
      email: user.email,
      role_id: ROLE_IDS.CLIENT,
    },
  };
}

function getUserFromAccessToken(token) {
  const payload = decodeTokenPayload(token, MOCK_TOKEN_PREFIX);

  if (!payload?.sub || !payload.email) {
    throw new UnauthorizedError("Invalid or expired token");
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new UnauthorizedError("Invalid or expired token");
  }

  const user = usersById.get(payload.sub);

  if (!user) {
    throw new UnauthorizedError("Invalid or expired token");
  }

  return user;
}

class AuthMockService {
  async register({ email, password, fullName }) {
    const normalizedEmail = email.trim().toLowerCase();

    if (usersByEmail.has(normalizedEmail)) {
      throw new ConflictError("Email already registered", "EMAIL_EXISTS");
    }

    const user = {
      id: createUserId(),
      email: normalizedEmail,
      password,
      fullName: fullName?.trim() || "",
    };

    usersByEmail.set(normalizedEmail, user);
    usersById.set(user.id, user);

    return {
      user: formatUser(user),
      session: createSession(user.id, user.email),
      message: "Registration successful (local mock auth)",
    };
  }

  async login({ email, password }) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = usersByEmail.get(normalizedEmail);

    if (!user || user.password !== password) {
      throw new UnauthorizedError("Invalid email or password");
    }

    return {
      user: formatUser(user),
      session: createSession(user.id, user.email),
    };
  }

  async refresh({ refreshToken }) {
    const payload = decodeTokenPayload(refreshToken, MOCK_REFRESH_PREFIX);

    if (!payload?.sub || payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    const user = usersById.get(payload.sub);

    if (!user) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    return {
      user: formatUser(user),
      session: createSession(user.id, user.email),
    };
  }

  async getMe(actor) {
    const user = usersById.get(actor.id);

    if (!user) {
      throw new ValidationError("Profile not found");
    }

    return {
      user: formatUser(user),
    };
  }
}

module.exports = {
  AuthMockService,
  getUserFromAccessToken,
};
