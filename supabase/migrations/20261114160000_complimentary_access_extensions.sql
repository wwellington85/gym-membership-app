BEGIN;
CREATE TABLE public.access_pass_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id uuid NOT NULL REFERENCES public.access_passes(id),
  member_id uuid NOT NULL REFERENCES public.members(id),
  actor_id uuid NOT NULL,
  previous_end_date date NOT NULL,
  new_end_date date NOT NULL CHECK (new_end_date > previous_end_date),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 500),
  submission_key uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX access_pass_extensions_member_time_idx ON public.access_pass_extensions(member_id,created_at DESC);
ALTER TABLE public.access_pass_extensions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.access_pass_extensions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.access_pass_extensions TO service_role;

CREATE OR REPLACE FUNCTION public.extend_access_pass(
  p_pass_id uuid,p_member_id uuid,p_expected_end date,p_new_end date,
  p_reason text,p_staff_id uuid,p_key uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_pass public.access_passes%ROWTYPE; v_previous public.access_pass_extensions%ROWTYPE;
  v_id uuid; v_today date := (now() AT TIME ZONE 'America/Jamaica')::date;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff_profiles WHERE user_id=p_staff_id AND role='admin' AND is_active IS NOT FALSE) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF p_key IS NULL OR p_expected_end IS NULL OR p_new_end IS NULL OR NOT isfinite(p_new_end)
    OR p_new_end > date '9999-12-31' OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500
    THEN RAISE EXCEPTION 'Choose a valid later expiry and give a reason'; END IF;
  -- Serialize against member deactivation and other changes to this pass.
  PERFORM id FROM public.members WHERE id=p_member_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member is inactive or not found'; END IF;
  SELECT * INTO v_previous FROM public.access_pass_extensions WHERE submission_key=p_key;
  IF FOUND THEN
    IF v_previous.pass_id=p_pass_id AND v_previous.member_id=p_member_id AND v_previous.actor_id=p_staff_id
      AND v_previous.previous_end_date=p_expected_end AND v_previous.new_end_date=p_new_end AND v_previous.reason=trim(p_reason)
      THEN RETURN v_previous.id; END IF;
    RAISE EXCEPTION 'Submission key already used';
  END IF;
  SELECT * INTO v_pass FROM public.access_passes WHERE id=p_pass_id AND member_id=p_member_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pass not found for this member'; END IF;
  IF v_pass.status <> 'active' THEN RAISE EXCEPTION 'A revoked pass cannot be extended'; END IF;
  IF v_pass.paid_through_date <> p_expected_end THEN RAISE EXCEPTION 'Expiry changed; reload the member record'; END IF;
  IF p_new_end <= v_pass.paid_through_date OR p_new_end < v_today
    OR (p_new_end=v_today AND (now() AT TIME ZONE 'America/Jamaica')::time >= time '22:00')
    THEN RAISE EXCEPTION 'Choose an expiry later than the current date and still valid'; END IF;
  -- Only the end date changes: retain payment, snapshot, start, source and staff grant.
  UPDATE public.access_passes SET paid_through_date=p_new_end WHERE id=p_pass_id;
  INSERT INTO public.access_pass_extensions(pass_id,member_id,actor_id,previous_end_date,new_end_date,reason,submission_key)
  VALUES(p_pass_id,p_member_id,p_staff_id,v_pass.paid_through_date,p_new_end,trim(p_reason),p_key) RETURNING id INTO v_id;
  INSERT INTO public.club_audit_events(actor_id,member_id,action,detail)
  VALUES(p_staff_id,p_member_id,'access_pass_extended',jsonb_build_object(
    'pass_id',p_pass_id,'extension_id',v_id,'previous_end_date',v_pass.paid_through_date,
    'new_end_date',p_new_end,'reason',trim(p_reason),'complimentary',true));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.extend_access_pass(uuid,uuid,date,date,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.extend_access_pass(uuid,uuid,date,date,text,uuid,uuid) TO service_role;
COMMIT;
