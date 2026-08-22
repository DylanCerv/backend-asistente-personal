-- Safe follow-up: allow re-queue after a failed / empty-token claim cycle
-- (no schema break if 015 already ran)

CREATE OR REPLACE FUNCTION public.requeue_scheduled_notification(notification_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.scheduled_notifications
  SET
    status = 'pending',
    sent_at = null,
    error = null,
    updated_at = now()
  WHERE id = notification_id
    AND status IN ('sent', 'failed');
END;
$$;

REVOKE ALL ON FUNCTION public.requeue_scheduled_notification(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.requeue_scheduled_notification(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.requeue_scheduled_notification(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_scheduled_notification(UUID) TO service_role;
