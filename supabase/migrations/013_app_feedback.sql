-- App feedback / ratings (1–5 stars + optional comment)

CREATE TABLE IF NOT EXISTS public.app_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL DEFAULT '',
  app_version TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_feedback_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_app_feedback_created_at
  ON public.app_feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_feedback_rating
  ON public.app_feedback (rating);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_feedback_updated_at ON public.app_feedback;
CREATE TRIGGER app_feedback_updated_at
  BEFORE UPDATE ON public.app_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_feedback_select" ON public.app_feedback;
DROP POLICY IF EXISTS "app_feedback_insert_own" ON public.app_feedback;
DROP POLICY IF EXISTS "app_feedback_update_own" ON public.app_feedback;

CREATE POLICY "app_feedback_select" ON public.app_feedback
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "app_feedback_insert_own" ON public.app_feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "app_feedback_update_own" ON public.app_feedback
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());
