-- Roles lookup table (numeric IDs, FK from profiles)

CREATE TABLE IF NOT EXISTS public.roles (
  id SMALLINT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT roles_name_unique UNIQUE (name)
);

INSERT INTO public.roles (id, name) VALUES
  (1, 'Cliente'),
  (2, 'Administrador')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role_id SMALLINT NOT NULL DEFAULT 1
  REFERENCES public.roles(id);

CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON public.profiles (role_id);

-- Signup: role_id = 1 (Cliente)
-- is_admin(): role_id = 2 (Administrador)

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_select_authenticated" ON public.roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "roles_select_anon" ON public.roles
  FOR SELECT TO anon USING (true);
