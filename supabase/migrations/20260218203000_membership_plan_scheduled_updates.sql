-- Schedule future membership plan changes (discounts/access/join visibility).

CREATE TABLE IF NOT EXISTS membership_plan_scheduled_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES membership_plans(id) ON DELETE CASCADE,
  effective_on date NOT NULL,
  discount_food numeric,
  discount_spa numeric,
  discount_giftshop numeric,
  discount_watersports numeric,
  grants_access boolean,
  visible_on_join boolean,
  note text,
  applied_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS membership_plan_scheduled_updates_plan_effective_idx
  ON membership_plan_scheduled_updates (plan_id, effective_on, applied_at);

ALTER TABLE membership_plan_scheduled_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS membership_plan_scheduled_updates_admin_manage ON membership_plan_scheduled_updates;
CREATE POLICY membership_plan_scheduled_updates_admin_manage
ON membership_plan_scheduled_updates
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM staff_profiles sp
    WHERE sp.user_id = auth.uid()
      AND sp.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM staff_profiles sp
    WHERE sp.user_id = auth.uid()
      AND sp.role = 'admin'
  )
);
