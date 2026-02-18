-- In-app renewal notifications for members.
-- Two reminder windows: 14 days and 3 days before paid_through_date.

CREATE TABLE IF NOT EXISTS membership_renewal_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  paid_through_date date NOT NULL,
  reminder_key text NOT NULL CHECK (reminder_key IN ('14d', '3d')),
  reminder_days integer NOT NULL CHECK (reminder_days IN (14, 3)),
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS membership_renewal_notifications_unique_uq
  ON membership_renewal_notifications (member_id, membership_id, paid_through_date, reminder_key);

CREATE INDEX IF NOT EXISTS membership_renewal_notifications_member_seen_idx
  ON membership_renewal_notifications (member_id, seen_at, created_at DESC);

ALTER TABLE membership_renewal_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_renewal_notifications_select_own ON membership_renewal_notifications;
CREATE POLICY member_renewal_notifications_select_own
ON membership_renewal_notifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM members m
    WHERE m.id = membership_renewal_notifications.member_id
      AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS member_renewal_notifications_update_own ON membership_renewal_notifications;
CREATE POLICY member_renewal_notifications_update_own
ON membership_renewal_notifications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM members m
    WHERE m.id = membership_renewal_notifications.member_id
      AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM members m
    WHERE m.id = membership_renewal_notifications.member_id
      AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS staff_renewal_notifications_manage ON membership_renewal_notifications;
CREATE POLICY staff_renewal_notifications_manage
ON membership_renewal_notifications
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM staff_profiles sp
    WHERE sp.user_id = auth.uid()
      AND sp.role IN ('admin', 'front_desk')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM staff_profiles sp
    WHERE sp.user_id = auth.uid()
      AND sp.role IN ('admin', 'front_desk')
  )
);
