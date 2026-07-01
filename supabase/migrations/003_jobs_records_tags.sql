-- Jobs, records, tags (all scoped by user_id → auth.users)

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER NOT NULL DEFAULT 0
    CHECK (progress >= 0 AND progress <= 100),
  audio_url TEXT,
  audio_path TEXT,
  transcription TEXT,
  structured_data JSONB,
  error JSONB,
  retry_count INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_pending_queue ON public.jobs (created_at ASC)
  WHERE status = 'pending' AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  type TEXT NOT NULL
    CHECK (type IN ('task', 'reminder', 'meeting', 'expense', 'income', 'note', 'idea')),
  title TEXT,
  description TEXT,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high') OR priority IS NULL),
  date TIMESTAMPTZ,
  client TEXT,
  project TEXT,
  amount NUMERIC(12, 2),
  currency TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_records_user_id ON public.records (user_id);
CREATE INDEX IF NOT EXISTS idx_records_job_id ON public.records (job_id);
CREATE INDEX IF NOT EXISTS idx_records_type ON public.records (type);

CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tags_user_name_unique UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON public.tags (user_id);

CREATE TABLE IF NOT EXISTS public.record_tags (
  record_id UUID NOT NULL REFERENCES public.records(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (record_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_record_tags_user_id ON public.record_tags (user_id);
CREATE INDEX IF NOT EXISTS idx_record_tags_tag_id ON public.record_tags (tag_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON public.jobs;
CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_records_updated_at ON public.records;
CREATE TRIGGER trg_records_updated_at
  BEFORE UPDATE ON public.records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tags_updated_at ON public.tags;
CREATE TRIGGER trg_tags_updated_at
  BEFORE UPDATE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.claim_next_pending_job()
RETURNS SETOF public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.jobs
  SET
    status = 'processing',
    progress = 10,
    updated_at = now()
  WHERE id = (
    SELECT j.id
    FROM public.jobs j
    WHERE j.status = 'pending'
      AND j.deleted_at IS NULL
    ORDER BY j.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_pending_job() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_next_pending_job() FROM anon;
REVOKE ALL ON FUNCTION public.claim_next_pending_job() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_pending_job() TO service_role;
