BEGIN;
-- One shared visit record across all staff check-in locations. Existing history
-- remains untouched; row locking makes simultaneous gate/restaurant scans safe.
CREATE OR REPLACE FUNCTION public.record_club_visit(p_member_id uuid, p_staff_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_today date := (now() AT TIME ZONE 'America/Jamaica')::date;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff_profiles WHERE user_id = p_staff_id AND role IN ('admin','front_desk','security') AND is_active IS NOT FALSE) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  PERFORM id FROM public.members WHERE id = p_member_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member is inactive'; END IF;
  IF EXISTS (SELECT 1 FROM public.checkins WHERE member_id = p_member_id AND (checked_in_at AT TIME ZONE 'America/Jamaica')::date = v_today) THEN RETURN false; END IF;
  INSERT INTO public.checkins(member_id, staff_user_id, points_earned) VALUES (p_member_id, p_staff_id, 3);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.record_club_visit(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_club_visit(uuid,uuid) TO service_role;
-- Keep old deployments on the same daily guard while this release rolls out.
CREATE OR REPLACE FUNCTION public.record_gym_visit(p_member_id uuid, p_staff_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.record_club_visit(p_member_id, p_staff_id);
$$;
REVOKE ALL ON FUNCTION public.record_gym_visit(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_gym_visit(uuid,uuid) TO service_role;
-- Aggregate in SQL so long-standing members do not hit API row limits.
CREATE OR REPLACE FUNCTION public.club_visit_points(p_member_id uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(sum(points_earned),0)::bigint FROM public.checkins WHERE member_id=p_member_id;
$$;
REVOKE ALL ON FUNCTION public.club_visit_points(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_visit_points(uuid) TO service_role;
COMMIT;
