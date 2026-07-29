-- Alert sound + vibration preferences for reminder notifications.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS reminder_alert_sound TEXT NOT NULL DEFAULT 'system'
  CHECK (reminder_alert_sound IN ('system', 'kivo_soft', 'kivo_clear', 'kivo_urgent'));

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS reminder_alert_vibration TEXT NOT NULL DEFAULT 'normal'
  CHECK (reminder_alert_vibration IN ('normal', 'soft', 'strong', 'alarm'));
