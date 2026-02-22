-- Track automatic downgrade context when an expired paid membership is moved to Rewards Free.
ALTER TABLE IF EXISTS public.memberships
  ADD COLUMN IF NOT EXISTS downgraded_from_plan_code text,
  ADD COLUMN IF NOT EXISTS downgraded_from_plan_name text,
  ADD COLUMN IF NOT EXISTS downgraded_on date;

CREATE INDEX IF NOT EXISTS memberships_downgraded_on_idx
  ON public.memberships (downgraded_on);
