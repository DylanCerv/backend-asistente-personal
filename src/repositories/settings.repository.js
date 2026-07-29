const { getServiceClient } = require("../clients/supabase.client");

const SETTINGS_SELECT = `
  user_id,
  language,
  push_notifications,
  reminder_notifications,
  reminder_alert_style,
  reminder_alert_sound,
  reminder_alert_vibration,
  auto_send_audio,
  biometric_lock,
  preferred_name,
  plan,
  created_at,
  updated_at
`;

const DEFAULTS = {
  language: "es",
  push_notifications: true,
  reminder_notifications: true,
  reminder_alert_style: "both",
  reminder_alert_sound: "system",
  reminder_alert_vibration: "normal",
  auto_send_audio: false,
  biometric_lock: false,
  preferred_name: "",
  plan: "free",
};

class SettingsRepository {
  constructor(client = null) {
    this.client = client;
  }

  getClient() {
    if (!this.client) this.client = getServiceClient();
    return this.client;
  }

  get table() {
    return "user_settings";
  }

  async findByUserId(userId) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .select(SETTINGS_SELECT)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data ?? { user_id: userId, ...DEFAULTS };
  }

  /** Upsert — creates the row if it doesn't exist, merges if it does */
  async upsert(userId, payload) {
    const { data, error } = await this.getClient()
      .from(this.table)
      .upsert(
        { user_id: userId, ...payload },
        { onConflict: "user_id", ignoreDuplicates: false }
      )
      .select(SETTINGS_SELECT)
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = SettingsRepository;
