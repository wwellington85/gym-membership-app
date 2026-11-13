BEGIN;

-- Guard manual SQL-editor execution against a different application's schema.
DO $$ BEGIN
  IF to_regclass('public.access_passes') IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.membership_plans WHERE code = 'rewards_free'
  ) THEN RAISE EXCEPTION 'This migration requires the gym/Club database'; END IF;
END $$;

-- Adding an identity column assigns every existing row a number automatically.
-- The bounded, non-cycling sequence plus unique index prevents collisions, even
-- for concurrent enrolments. Numbers identify records; they never grant access.
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS member_number bigint
  GENERATED ALWAYS AS IDENTITY (
    START WITH 482719368001 MINVALUE 100000000000 MAXVALUE 999999999999 NO CYCLE
  );
CREATE UNIQUE INDEX IF NOT EXISTS members_member_number_unique ON public.members(member_number);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.members'::regclass AND conname='members_member_number_12_digits') THEN
    ALTER TABLE public.members ADD CONSTRAINT members_member_number_12_digits
      CHECK (member_number BETWEEN 100000000000 AND 999999999999);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.preserve_member_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.member_number IS DISTINCT FROM OLD.member_number THEN
    RAISE EXCEPTION 'Membership numbers are permanent';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS members_preserve_number ON public.members;
CREATE TRIGGER members_preserve_number BEFORE UPDATE OF member_number ON public.members
FOR EACH ROW EXECUTE FUNCTION public.preserve_member_number();
REVOKE ALL ON FUNCTION public.preserve_member_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.members_member_number_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SEQUENCE public.members_member_number_seq TO service_role;

CREATE OR REPLACE FUNCTION public.search_club_members(p_query text, p_filter text, p_page integer, p_size integer)
RETURNS TABLE(id uuid, full_name text, phone text, email text, is_active boolean, scope text, valid_through date, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH matching AS (
    SELECT m.id, m.full_name::text, m.phone::text, m.email::text, m.is_active,
      coalesce(a.scope,'none') AS scope, a.valid_through
    FROM public.members m
    LEFT JOIN LATERAL (
      SELECT CASE WHEN bool_or(ap.plan_snapshot->>'access_scope' = 'resort') THEN 'resort' ELSE 'gym' END AS scope, max(ap.paid_through_date) AS valid_through
      FROM public.access_passes ap WHERE ap.member_id = m.id AND ap.status = 'active'
        AND ap.start_date <= (now() AT TIME ZONE 'America/Jamaica')::date
        AND (ap.paid_through_date > (now() AT TIME ZONE 'America/Jamaica')::date OR (ap.paid_through_date = (now() AT TIME ZONE 'America/Jamaica')::date AND (now() AT TIME ZONE 'America/Jamaica')::time < time '22:00'))
      HAVING count(*) > 0
    ) a ON m.is_active
    WHERE (coalesce(p_query,'') = '' OR m.full_name ILIKE '%' || p_query || '%' OR m.phone ILIKE '%' || p_query || '%' OR m.email ILIKE '%' || p_query || '%' OR m.member_number::text = regexp_replace(trim(p_query), '[[:space:]-]', '', 'g') OR replace(m.id::text,'-','') = replace(regexp_replace(p_query,'^TC-','','i'),'-',''))
  )
  SELECT x.*, count(*) OVER() FROM matching x
  WHERE CASE p_filter
    WHEN 'inactive' THEN NOT x.is_active
    WHEN 'access' THEN x.is_active AND x.scope <> 'none'
    WHEN 'rewards' THEN x.is_active AND x.scope = 'none'
    WHEN 'due_soon' THEN x.is_active AND x.valid_through <= (now() AT TIME ZONE 'America/Jamaica')::date + 3
    WHEN 'all_records' THEN true
    ELSE x.is_active END
  ORDER BY x.full_name, x.id
  LIMIT least(greatest(p_size,1),100) OFFSET greatest(p_page,0) * least(greatest(p_size,1),100)
$$;
REVOKE ALL ON FUNCTION public.search_club_members(text,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_club_members(text,text,integer,integer) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
