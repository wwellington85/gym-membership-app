-- Support username-first staff accounts with optional real email.
-- Existing rows fall back to email as username.

ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS username text;

UPDATE public.staff_profiles
SET username = lower(email)
WHERE username IS NULL
  AND email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS staff_profiles_username_lower_uq
  ON public.staff_profiles (lower(username))
  WHERE username IS NOT NULL;
