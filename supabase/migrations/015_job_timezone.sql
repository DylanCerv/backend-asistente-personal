-- Capture jobs keep the client IANA timezone so "hoy" and clock times
-- are interpreted in the phone's zone, not the server's.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS time_zone TEXT;
