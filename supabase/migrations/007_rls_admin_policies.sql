-- RLS with admin bypass via is_admin()

-- PROFILES
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- JOBS
DROP POLICY IF EXISTS "jobs_select_own" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_own" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_own" ON public.jobs;
DROP POLICY IF EXISTS "jobs_select" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update" ON public.jobs;

CREATE POLICY "jobs_select" ON public.jobs FOR SELECT TO authenticated
  USING ((auth.uid() = user_id AND deleted_at IS NULL) OR public.is_admin());

CREATE POLICY "jobs_insert_own" ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "jobs_update" ON public.jobs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- RECORDS
DROP POLICY IF EXISTS "records_select_own" ON public.records;
DROP POLICY IF EXISTS "records_insert_own" ON public.records;
DROP POLICY IF EXISTS "records_update_own" ON public.records;
DROP POLICY IF EXISTS "records_delete_own" ON public.records;
DROP POLICY IF EXISTS "records_select" ON public.records;
DROP POLICY IF EXISTS "records_update" ON public.records;
DROP POLICY IF EXISTS "records_delete" ON public.records;

CREATE POLICY "records_select" ON public.records FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "records_insert_own" ON public.records FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "records_update" ON public.records FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "records_delete" ON public.records FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- TAGS
DROP POLICY IF EXISTS "tags_select_own" ON public.tags;
DROP POLICY IF EXISTS "tags_insert_own" ON public.tags;
DROP POLICY IF EXISTS "tags_update_own" ON public.tags;
DROP POLICY IF EXISTS "tags_delete_own" ON public.tags;
DROP POLICY IF EXISTS "tags_select" ON public.tags;
DROP POLICY IF EXISTS "tags_update" ON public.tags;
DROP POLICY IF EXISTS "tags_delete" ON public.tags;

CREATE POLICY "tags_select" ON public.tags FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "tags_insert_own" ON public.tags FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tags_update" ON public.tags FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "tags_delete" ON public.tags FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- RECORD_TAGS
DROP POLICY IF EXISTS "record_tags_select_own" ON public.record_tags;
DROP POLICY IF EXISTS "record_tags_insert_own" ON public.record_tags;
DROP POLICY IF EXISTS "record_tags_delete_own" ON public.record_tags;
DROP POLICY IF EXISTS "record_tags_select" ON public.record_tags;
DROP POLICY IF EXISTS "record_tags_delete" ON public.record_tags;

CREATE POLICY "record_tags_select" ON public.record_tags FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "record_tags_insert_own" ON public.record_tags FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.records r WHERE r.id = record_id AND r.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.tags t WHERE t.id = tag_id AND t.user_id = auth.uid())
  );

CREATE POLICY "record_tags_delete" ON public.record_tags FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());
