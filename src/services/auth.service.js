const { getAnonClient, getServiceClient } = require("../clients/supabase.client");
const ProfileRepository = require("../repositories/profile.repository");
const { ROLE_IDS } = require("../constants/roles");
const {
  ValidationError,
  UnauthorizedError,
  ConflictError,
} = require("../errors/AppError");

class AuthService {
  constructor(profileRepository = new ProfileRepository()) {
    this.profileRepository = profileRepository;
  }

  getSupabase() {
    const client = getAnonClient();
    if (!client) {
      throw new ValidationError("SUPABASE_ANON_KEY is not configured");
    }
    return client;
  }

  mapAuthError(error) {
    const message = error.message?.toLowerCase() || "";

    if (message.includes("already registered") || message.includes("already exists")) {
      return new ConflictError("Email already registered", "EMAIL_EXISTS");
    }

    if (message.includes("invalid login credentials")) {
      return new UnauthorizedError("Invalid email or password");
    }

    if (message.includes("email not confirmed")) {
      return new UnauthorizedError("Email not confirmed. Check your inbox.");
    }

    return new ValidationError(error.message);
  }

  formatSession(session) {
    if (!session) {
      return null;
    }

    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at,
      expiresIn: session.expires_in,
    };
  }

  formatUser(user, profile) {
    return {
      id: user.id,
      email: user.email,
      roleId: profile?.role_id || ROLE_IDS.CLIENT,
      role: profile?.roles || { id: ROLE_IDS.CLIENT, name: "Cliente" },
      profile: profile
        ? {
            fullName: profile.full_name ?? null,
            avatarUrl: profile.avatar_url ?? null,
          }
        : null,
    };
  }

  async ensureProfile(user, fullName) {
    let profile = await this.profileRepository.findById(user.id);

    if (!profile) {
      profile = await this.profileRepository.create({
        id: user.id,
        email: user.email,
        full_name: fullName || user.user_metadata?.full_name || "",
        role_id: ROLE_IDS.CLIENT,
      });
    }

    return profile;
  }

  async signInAfterRegister(email, password) {
    const supabase = this.getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      throw new ValidationError("Could not create session after registration");
    }

    return data.session;
  }

  /**
   * Registration always uses Admin API (service_role).
   * Never calls auth.signUp — that is the only client method that triggers Supabase emails.
   */
  async register({ email, password, fullName }) {
    const admin = getServiceClient();

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || "",
      },
    });

    if (error) {
      throw this.mapAuthError(error);
    }

    if (!data.user) {
      throw new ValidationError("Registration failed");
    }

    const session = await this.signInAfterRegister(email, password);
    const profile = await this.ensureProfile(data.user, fullName);

    return {
      user: this.formatUser(data.user, profile),
      session: this.formatSession(session),
      message: "Registration successful",
    };
  }

  async signInWithOAuth({ provider, idToken, nonce }) {
    const supabase = this.getSupabase();
    const credentials = { provider, token: idToken };

    if (nonce) {
      credentials.nonce = nonce;
    }

    const { data, error } = await supabase.auth.signInWithIdToken(credentials);

    if (error) {
      throw this.mapAuthError(error);
    }

    if (!data.user || !data.session) {
      throw new UnauthorizedError("Social login failed");
    }

    const fullName =
      data.user.user_metadata?.full_name ||
      data.user.user_metadata?.name ||
      data.user.user_metadata?.given_name ||
      "";

    const profile = await this.ensureProfile(data.user, fullName);

    return {
      user: this.formatUser(data.user, profile),
      session: this.formatSession(data.session),
    };
  }

  async login({ email, password }) {
    const supabase = this.getSupabase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw this.mapAuthError(error);
    }

    if (!data.user || !data.session) {
      throw new UnauthorizedError("Login failed");
    }

    const profile = await this.ensureProfile(data.user);

    return {
      user: this.formatUser(data.user, profile),
      session: this.formatSession(data.session),
    };
  }

  async refresh({ refreshToken }) {
    const supabase = this.getSupabase();

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    if (!data.user || !data.session) {
      throw new UnauthorizedError("Could not refresh session");
    }

    const profile = await this.profileRepository.findById(data.user.id);

    return {
      user: this.formatUser(data.user, profile),
      session: this.formatSession(data.session),
    };
  }

  async changePassword(actor, { currentPassword, newPassword }) {
    const supabase = this.getSupabase();

    // Verify current password by attempting sign-in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: actor.email,
      password: currentPassword,
    });

    if (signInError) {
      throw new UnauthorizedError("La contraseña actual es incorrecta");
    }

    // Update to new password using admin client
    const admin = getServiceClient();
    const { error: updateError } = await admin.auth.admin.updateUserById(actor.id, {
      password: newPassword,
    });

    if (updateError) {
      throw new ValidationError("No se pudo actualizar la contraseña");
    }
  }

  async getMe(actor) {
    const profile = await this.profileRepository.findById(actor.id);

    if (!profile) {
      throw new ValidationError("Profile not found");
    }

    return {
      user: this.formatUser(actor, profile),
    };
  }
}

module.exports = AuthService;
