BEGIN;

DO $$ BEGIN
  IF to_regclass('public.access_passes') IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.membership_plans WHERE code = 'rewards_free'
  ) THEN RAISE EXCEPTION 'This migration requires the gym/Club database'; END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS public.club_member_number_16_seq AS bigint
  MINVALUE 1000000000000000 MAXVALUE 9999999999999999 START 4827193680010041 NO CYCLE;

-- Owner-approved one-time extension before numbers were in use. Text avoids
-- JavaScript precision loss for values above Number.MAX_SAFE_INTEGER.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='members' AND column_name='member_number' AND is_identity='YES') THEN
    IF EXISTS (SELECT 1 FROM public.members WHERE length(member_number::text) <> 12) THEN
      RAISE EXCEPTION 'Expected existing 12-digit numbers before conversion';
    END IF;
    DROP TRIGGER IF EXISTS members_preserve_number ON public.members;
    ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_member_number_12_digits;
    ALTER TABLE public.members ALTER COLUMN member_number DROP IDENTITY;
    ALTER TABLE public.members ALTER COLUMN member_number TYPE text
      USING member_number::text || '0041';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.members'::regclass AND conname='members_member_number_16_digits') THEN
    ALTER TABLE public.members ADD CONSTRAINT members_member_number_16_digits
      CHECK (member_number ~ '^[1-9][0-9]{15}$');
  END IF;
END $$;

-- Never rewind allocation on a re-run, including after a rolled-back insert.
SELECT setval('public.club_member_number_16_seq', greatest(
  (SELECT last_value FROM public.club_member_number_16_seq),
  coalesce((SELECT max(member_number::bigint) FROM public.members), 4827193680010041)
), true);

CREATE OR REPLACE FUNCTION public.assign_member_number_16()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.member_number IS NOT NULL THEN
    RAISE EXCEPTION 'Membership numbers are assigned automatically';
  END IF;
  NEW.member_number := nextval('public.club_member_number_16_seq'::regclass)::text;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS members_assign_number_16 ON public.members;
CREATE TRIGGER members_assign_number_16 BEFORE INSERT ON public.members
FOR EACH ROW EXECUTE FUNCTION public.assign_member_number_16();
DROP TRIGGER IF EXISTS members_preserve_number ON public.members;
CREATE TRIGGER members_preserve_number BEFORE UPDATE OF member_number ON public.members
FOR EACH ROW EXECUTE FUNCTION public.preserve_member_number();
REVOKE ALL ON FUNCTION public.assign_member_number_16() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.club_member_number_16_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SEQUENCE public.club_member_number_16_seq TO service_role;

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
    WHERE (coalesce(p_query,'') = '' OR m.full_name ILIKE '%' || p_query || '%' OR m.phone ILIKE '%' || p_query || '%' OR m.email ILIKE '%' || p_query || '%' OR m.member_number::text = regexp_replace(trim(p_query), '[[:space:]-]', '', 'g') OR (length(regexp_replace(trim(p_query), '[[:space:]-]', '', 'g')) = 12 AND m.member_number = regexp_replace(trim(p_query), '[[:space:]-]', '', 'g') || '0041') OR replace(m.id::text,'-','') = replace(regexp_replace(p_query,'^TC-','','i'),'-',''))
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
