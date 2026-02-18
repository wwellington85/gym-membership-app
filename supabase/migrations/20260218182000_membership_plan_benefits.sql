-- Custom benefits per membership plan.
-- Enables management to add/update package-specific perks that display in member app.

CREATE TABLE IF NOT EXISTS membership_plan_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES membership_plans(id) ON DELETE CASCADE,
  label text NOT NULL,
  value text NOT NULL,
  sort_order integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS membership_plan_benefits_plan_sort_idx
  ON membership_plan_benefits (plan_id, sort_order, created_at);

ALTER TABLE membership_plan_benefits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS membership_plan_benefits_select_policy ON membership_plan_benefits;
CREATE POLICY membership_plan_benefits_select_policy
ON membership_plan_benefits
FOR SELECT
TO authenticated
USING (
  is_active = true
  OR EXISTS (
    SELECT 1
    FROM staff_profiles sp
    WHERE sp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS membership_plan_benefits_admin_manage_policy ON membership_plan_benefits;
CREATE POLICY membership_plan_benefits_admin_manage_policy
ON membership_plan_benefits
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
