ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS reminder_alert_style TEXT NOT NULL DEFAULT 'both'
  CHECK (reminder_alert_style IN ('sound', 'vibration', 'both'));
