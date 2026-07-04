-- Add preferences JSON column to profiles for storing user settings
-- language, notifications, preferredName, etc.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.preferences IS
  'User app preferences: language, pushNotifications, emailNotifications, reminderNotifications, biometricLock, preferredName';
