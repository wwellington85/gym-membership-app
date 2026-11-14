BEGIN;
-- Discount approval is separate from the member-editable account record and passes.
CREATE TABLE public.local_rewards (
  member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 500)
);
ALTER TABLE public.local_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.local_rewards FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.local_rewards TO service_role;
-- Preserve existing entitlements once. Future members have no approval by default.
INSERT INTO public.local_rewards(member_id,is_active,approved_at,reason)
SELECT id,true,now(),'Existing Rewards benefit preserved at Local Rewards launch' FROM public.members;
INSERT INTO public.club_audit_events(action,detail)
SELECT 'local_rewards_launch', jsonb_build_object('preserved_members',count(*)) FROM public.local_rewards;

CREATE OR REPLACE FUNCTION public.set_local_rewards(p_member_id uuid,p_active boolean,p_staff_id uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff_profiles WHERE user_id=p_staff_id AND role IN ('admin','front_desk') AND is_active IS NOT FALSE) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF p_active IS NULL OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Give a reason between 3 and 500 characters'; END IF;
  PERFORM id FROM public.members WHERE id=p_member_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF p_active AND NOT EXISTS (SELECT 1 FROM public.members WHERE id=p_member_id AND is_active) THEN RAISE EXCEPTION 'Member is inactive'; END IF;
  INSERT INTO public.local_rewards(member_id,is_active,approved_by,approved_at,updated_by,reason)
  VALUES(p_member_id,p_active,CASE WHEN p_active THEN p_staff_id END,CASE WHEN p_active THEN now() END,p_staff_id,trim(p_reason))
  ON CONFLICT(member_id) DO UPDATE SET is_active=EXCLUDED.is_active,
    approved_by=CASE WHEN p_active THEN p_staff_id ELSE local_rewards.approved_by END,
    approved_at=CASE WHEN p_active THEN now() ELSE local_rewards.approved_at END,
    updated_by=p_staff_id,updated_at=now(),reason=trim(p_reason);
  INSERT INTO public.club_audit_events(actor_id,member_id,action,detail)
  VALUES(p_staff_id,p_member_id,CASE WHEN p_active THEN 'local_rewards_approved' ELSE 'local_rewards_removed' END,jsonb_build_object('reason',trim(p_reason)));
END $$;
REVOKE ALL ON FUNCTION public.set_local_rewards(uuid,boolean,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_local_rewards(uuid,boolean,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.record_benefit_use(p_member_id uuid,p_outlet text,p_reference text,p_staff_id uuid,p_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_key text; v_rate numeric; v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff_profiles WHERE user_id=p_staff_id AND role IN ('admin','front_desk') AND is_active IS NOT FALSE) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  PERFORM id FROM public.members WHERE id=p_member_id AND is_active FOR UPDATE;
  IF NOT FOUND OR length(trim(coalesce(p_reference,''))) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid member or bill reference'; END IF;
  v_key := CASE p_outlet WHEN 'restaurant' THEN 'discount_food' WHEN 'spa' THEN 'discount_spa' WHEN 'giftshop' THEN 'discount_giftshop' WHEN 'watersports' THEN 'discount_watersports' END;
  IF v_key IS NULL THEN RAISE EXCEPTION 'Unknown outlet'; END IF;
  SELECT id INTO v_id FROM public.benefit_uses WHERE submission_key=p_key AND member_id=p_member_id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT max(rate) INTO v_rate FROM (
    SELECT (to_jsonb(p)->>v_key)::numeric AS rate FROM public.membership_plans p WHERE p.code='rewards_free' AND p.is_active
      AND EXISTS (SELECT 1 FROM public.local_rewards lr WHERE lr.member_id=p_member_id AND lr.is_active)
    UNION ALL
    SELECT (a.plan_snapshot->>v_key)::numeric FROM public.access_passes a WHERE a.member_id=p_member_id AND a.status='active'
      AND a.start_date <= (now() AT TIME ZONE 'America/Jamaica')::date
      AND (a.paid_through_date > (now() AT TIME ZONE 'America/Jamaica')::date OR (a.paid_through_date=(now() AT TIME ZONE 'America/Jamaica')::date AND (now() AT TIME ZONE 'America/Jamaica')::time < time '22:00'))
  ) rates;
  IF coalesce(v_rate,0) <= 0 OR v_rate > 1 THEN RAISE EXCEPTION 'No eligible discount'; END IF;
  INSERT INTO public.benefit_uses(member_id,outlet,bill_reference,discount_percent,staff_user_id,submission_key)
  VALUES(p_member_id,p_outlet,lower(trim(p_reference)),v_rate*100,p_staff_id,p_key) RETURNING id INTO v_id;
  INSERT INTO public.club_audit_events(actor_id,member_id,action,detail) VALUES(p_staff_id,p_member_id,'benefit_use_recorded',jsonb_build_object('outlet',p_outlet,'use_id',v_id,'discount_percent',v_rate*100));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.record_benefit_use(uuid,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_benefit_use(uuid,text,text,uuid,uuid) TO service_role;

COMMIT;
