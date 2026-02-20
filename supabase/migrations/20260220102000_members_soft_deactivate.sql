-- Allow management to soft-deactivate duplicate or retired member records.
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS members_is_active_created_at_idx
  ON public.members (is_active, created_at DESC);
