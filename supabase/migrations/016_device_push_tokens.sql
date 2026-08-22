-- Expo / FCM push tokens per device (same user → many devices)

CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown'
    CHECK (platform IN ('ios', 'android', 'web', 'unknown')),
  device_id TEXT,
  app_version TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT device_push_tokens_token_unique UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user_id
  ON public.device_push_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user_last_seen
  ON public.device_push_tokens (user_id, last_seen_at DESC);

DROP TRIGGER IF EXISTS trg_device_push_tokens_updated_at ON public.device_push_tokens;
CREATE TRIGGER trg_device_push_tokens_updated_at
  BEFORE UPDATE ON public.device_push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;
