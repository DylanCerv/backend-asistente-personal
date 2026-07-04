-- Create user_settings table (replaces JSONB preferences column in profiles)
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'es' CHECK (language IN ('es', 'en')),
  push_notifications BOOLEAN NOT NULL DEFAULT true,
  reminder_notifications BOOLEAN NOT NULL DEFAULT true,
  auto_send_audio BOOLEAN NOT NULL DEFAULT false,
  biometric_lock BOOLEAN NOT NULL DEFAULT false,
  preferred_name TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_settings_updated_at ON public.user_settings;
CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_settings" ON public.user_settings;
CREATE POLICY "users_own_settings" ON public.user_settings
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.profiles DROP COLUMN IF EXISTS preferences;
