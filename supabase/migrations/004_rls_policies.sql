-- RLS: authenticated users (anon key + JWT) only see their own data

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_tags ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- JOBS
CREATE POLICY "jobs_select_own" ON public.jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "jobs_insert_own" ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "jobs_update_own" ON public.jobs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RECORDS
CREATE POLICY "records_select_own" ON public.records FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "records_insert_own" ON public.records FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "records_update_own" ON public.records FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "records_delete_own" ON public.records FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- TAGS
CREATE POLICY "tags_select_own" ON public.tags FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "tags_insert_own" ON public.tags FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tags_update_own" ON public.tags FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tags_delete_own" ON public.tags FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- RECORD_TAGS
CREATE POLICY "record_tags_select_own" ON public.record_tags FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "record_tags_insert_own" ON public.record_tags FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.records r WHERE r.id = record_id AND r.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.tags t WHERE t.id = tag_id AND t.user_id = auth.uid())
  );
CREATE POLICY "record_tags_delete_own" ON public.record_tags FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
