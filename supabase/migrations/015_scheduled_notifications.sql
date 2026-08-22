-- Server-side notification schedule (source of truth for multi-device delivery)

CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_id UUID REFERENCES public.records(id) ON DELETE CASCADE,
  schedule_key TEXT NOT NULL,
  trigger_at TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  alert_level TEXT NOT NULL DEFAULT 'notification'
    CHECK (alert_level IN ('alarm', 'notification')),
  kind TEXT NOT NULL DEFAULT 'reminder'
    CHECK (kind IN ('critical', 'reminder', 'daily-summary', 'activity-warning')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT scheduled_notifications_user_key_unique UNIQUE (user_id, schedule_key)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_due
  ON public.scheduled_notifications (trigger_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_user
  ON public.scheduled_notifications (user_id, status);

DROP TRIGGER IF EXISTS trg_scheduled_notifications_updated_at ON public.scheduled_notifications;
CREATE TRIGGER trg_scheduled_notifications_updated_at
  BEFORE UPDATE ON public.scheduled_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Claim due notifications for the worker (SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.claim_due_scheduled_notifications(batch_size INTEGER DEFAULT 50)
RETURNS SETOF public.scheduled_notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.scheduled_notifications sn
  SET
    status = 'sent',
    sent_at = now(),
    updated_at = now()
  WHERE sn.id IN (
    SELECT n.id
    FROM public.scheduled_notifications n
    WHERE n.status = 'pending'
      AND n.trigger_at <= now()
    ORDER BY n.trigger_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(batch_size, 200))
  )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_scheduled_notifications(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_due_scheduled_notifications(INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.claim_due_scheduled_notifications(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_scheduled_notifications(INTEGER) TO service_role;

ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;
