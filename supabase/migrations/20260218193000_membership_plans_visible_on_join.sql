-- Controls whether a plan appears on the public /join page.
ALTER TABLE membership_plans
ADD COLUMN IF NOT EXISTS visible_on_join boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS membership_plans_active_join_visible_idx
  ON membership_plans (is_active, visible_on_join);
