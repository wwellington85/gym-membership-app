-- Normalize existing data and enforce de-duplication for membership applications.
-- Required index for case-insensitive uniqueness:
--   (lower(email), requested_start_date, status)

UPDATE membership_applications
SET email = lower(email)
WHERE email IS NOT NULL
  AND email <> lower(email);

WITH ranked AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY lower(email), requested_start_date, status
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM membership_applications
  WHERE email IS NOT NULL
)
DELETE FROM membership_applications AS m
USING ranked AS r
WHERE m.ctid = r.ctid
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS membership_applications_lower_email_start_status_uq
  ON membership_applications (lower(email), requested_start_date, status);

-- Secondary index to support PostgREST/Supabase upsert conflict targets.
CREATE UNIQUE INDEX IF NOT EXISTS membership_applications_email_start_status_uq
  ON membership_applications (email, requested_start_date, status);
