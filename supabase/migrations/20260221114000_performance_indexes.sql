-- Performance indexes for high-traffic staff workflows

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS members_full_name_trgm_idx
  ON public.members USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS members_phone_trgm_idx
  ON public.members USING gin (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS memberships_member_start_date_idx
  ON public.memberships (member_id, start_date DESC);

CREATE INDEX IF NOT EXISTS memberships_member_status_idx
  ON public.memberships (member_id, status);

CREATE INDEX IF NOT EXISTS payments_member_created_at_idx
  ON public.payments (member_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payments_membership_created_at_idx
  ON public.payments (membership_id, created_at DESC);

CREATE INDEX IF NOT EXISTS checkins_checked_in_at_idx
  ON public.checkins (checked_in_at DESC);

CREATE INDEX IF NOT EXISTS checkins_member_checked_in_at_idx
  ON public.checkins (member_id, checked_in_at DESC);
