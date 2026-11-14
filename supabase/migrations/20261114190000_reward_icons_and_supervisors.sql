BEGIN;
ALTER TABLE public.reward_gifts ADD COLUMN icon text NOT NULL DEFAULT 'gift' CHECK(icon IN ('drink','food','gift','treat'));
ALTER TABLE public.reward_gifts ADD COLUMN seen_at timestamptz;
CREATE TABLE public.reward_role_permissions (
 role text PRIMARY KEY CHECK(role IN ('supervisor','front_desk')),can_issue boolean NOT NULL,can_redeem boolean NOT NULL,can_revoke boolean NOT NULL
);
INSERT INTO public.reward_role_permissions VALUES('supervisor',true,true,true),('front_desk',false,true,false);
ALTER TABLE public.reward_role_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reward_role_permissions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.reward_role_permissions TO service_role;
CREATE OR REPLACE FUNCTION public.staff_has_reward_permission(p_staff_id uuid,p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.staff_profiles s LEFT JOIN public.reward_role_permissions p ON p.role=s.role
 WHERE s.user_id=p_staff_id AND s.is_active IS NOT FALSE AND p_permission IN ('issue','redeem','revoke')
 AND (s.role='admin' OR CASE p_permission WHEN 'issue' THEN p.can_issue WHEN 'redeem' THEN p.can_redeem WHEN 'revoke' THEN p.can_revoke ELSE false END));
$$;
REVOKE ALL ON FUNCTION public.staff_has_reward_permission(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.staff_has_reward_permission(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.set_reward_role_permissions(p_role text,p_issue boolean,p_redeem boolean,p_revoke boolean,p_staff_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.staff_profiles WHERE user_id=p_staff_id AND role='admin' AND is_active IS NOT FALSE) THEN RAISE EXCEPTION 'Not authorised'; END IF;
 IF p_role IS NULL OR p_role NOT IN ('supervisor','front_desk') OR p_issue IS NULL OR p_redeem IS NULL OR p_revoke IS NULL THEN RAISE EXCEPTION 'Invalid role permissions'; END IF;
 UPDATE public.reward_role_permissions SET can_issue=p_issue,can_redeem=p_redeem,can_revoke=p_revoke WHERE role=p_role;
 INSERT INTO public.club_audit_events(actor_id,action,detail) VALUES(p_staff_id,'reward_role_permissions_updated',jsonb_build_object('role',p_role,'issue',p_issue,'redeem',p_redeem,'revoke',p_revoke));
END $$;
REVOKE ALL ON FUNCTION public.set_reward_role_permissions(text,boolean,boolean,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_reward_role_permissions(text,boolean,boolean,boolean,uuid) TO service_role;
-- Supervisor inherits the operational front-desk checks, never admin checks.
DO $$ DECLARE signature text; definition text; BEGIN
 FOREACH signature IN ARRAY ARRAY['public.grant_staff_access(uuid,uuid,date,boolean,text,numeric,text,uuid,uuid)','public.record_club_visit(uuid,uuid)','public.record_gym_visit(uuid,uuid)','public.record_benefit_use(uuid,text,text,uuid,uuid)','public.set_local_rewards(uuid,boolean,uuid,text)','public.can_manage_payments()'] LOOP
  IF to_regprocedure(signature) IS NOT NULL THEN definition:=pg_get_functiondef(to_regprocedure(signature));
   IF position('''front_desk''' IN definition)>0 THEN EXECUTE replace(definition,'''front_desk''','''front_desk'',''supervisor'''); END IF;
  END IF;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.issue_reward_gift(p_member_id uuid,p_title text,p_terms text,p_reason text,p_category text,p_valid_until date,p_staff_id uuid,p_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_previous public.reward_gifts%ROWTYPE; v_today date := (now() AT TIME ZONE 'America/Jamaica')::date;
BEGIN
 IF NOT public.staff_has_reward_permission(p_staff_id,'issue') THEN RAISE EXCEPTION 'Not authorised'; END IF;
 IF p_key IS NULL OR length(trim(coalesce(p_title,''))) NOT BETWEEN 3 AND 120 OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 OR p_terms IS NULL OR length(p_terms)>1000 OR p_category IS NULL OR p_category NOT IN ('treat','quarterly_meal','other') OR p_valid_until IS NULL OR NOT isfinite(p_valid_until) OR p_valid_until>date '9999-12-31' THEN RAISE EXCEPTION 'Check reward details'; END IF;
 PERFORM id FROM public.members WHERE id=p_member_id AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member is inactive'; END IF;
 SELECT * INTO v_previous FROM public.reward_gifts WHERE submission_key=p_key;
 IF FOUND THEN
  IF v_previous.member_id=p_member_id AND v_previous.issued_by=p_staff_id AND v_previous.title=trim(p_title) AND v_previous.terms=trim(p_terms) AND v_previous.issue_reason=trim(p_reason) AND v_previous.category=p_category AND v_previous.valid_until=p_valid_until THEN RETURN v_previous.id; END IF;
  RAISE EXCEPTION 'Submission key already used';
 END IF;
 IF p_valid_until<v_today OR (p_valid_until=v_today AND (now() AT TIME ZONE 'America/Jamaica')::time>=time '22:00') THEN RAISE EXCEPTION 'Choose a valid future expiry'; END IF;
 INSERT INTO public.reward_gifts(member_id,title,terms,issue_reason,category,recognition_quarter,valid_until,issued_by,submission_key)
 VALUES(p_member_id,trim(p_title),trim(p_terms),trim(p_reason),p_category,CASE WHEN p_category='quarterly_meal' THEN date_trunc('quarter',v_today::timestamp)::date END,p_valid_until,p_staff_id,p_key) RETURNING id INTO v_id;
 INSERT INTO public.club_audit_events(actor_id,member_id,action,detail) VALUES(p_staff_id,p_member_id,'reward_gift_issued',jsonb_build_object('gift_id',v_id,'title',trim(p_title),'reason',trim(p_reason),'valid_until',p_valid_until,'points_deducted',0));
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.redeem_reward_gift(p_gift_id uuid,p_member_id uuid,p_staff_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_gift public.reward_gifts%ROWTYPE; v_today date := (now() AT TIME ZONE 'America/Jamaica')::date;
BEGIN
 IF NOT public.staff_has_reward_permission(p_staff_id,'redeem') THEN RAISE EXCEPTION 'Not authorised'; END IF;
 PERFORM id FROM public.members WHERE id=p_member_id AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member is inactive'; END IF;
 SELECT * INTO v_gift FROM public.reward_gifts WHERE id=p_gift_id AND member_id=p_member_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reward not found'; END IF;
 IF v_gift.status='redeemed' THEN RETURN false; END IF;
 IF v_gift.status<>'available' OR v_gift.valid_until<v_today OR (v_gift.valid_until=v_today AND (now() AT TIME ZONE 'America/Jamaica')::time>=time '22:00') THEN RAISE EXCEPTION 'Reward is unavailable'; END IF;
 UPDATE public.reward_gifts SET status='redeemed',redeemed_by=p_staff_id,redeemed_at=now() WHERE id=p_gift_id;
 INSERT INTO public.club_audit_events(actor_id,member_id,action,detail) VALUES(p_staff_id,p_member_id,'reward_gift_redeemed',jsonb_build_object('gift_id',p_gift_id,'title',v_gift.title,'points_deducted',0));
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.revoke_reward_gift(p_gift_id uuid,p_member_id uuid,p_staff_id uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.staff_has_reward_permission(p_staff_id,'revoke') OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Not authorised or missing reason'; END IF;
 PERFORM id FROM public.members WHERE id=p_member_id FOR UPDATE;
 UPDATE public.reward_gifts SET status='revoked',revoke_reason=trim(p_reason) WHERE id=p_gift_id AND member_id=p_member_id AND status='available';
 IF NOT FOUND THEN RAISE EXCEPTION 'Only an unused reward can be revoked'; END IF;
 INSERT INTO public.club_audit_events(actor_id,member_id,action,detail) VALUES(p_staff_id,p_member_id,'reward_gift_revoked',jsonb_build_object('gift_id',p_gift_id,'reason',trim(p_reason)));
END $$;

CREATE OR REPLACE FUNCTION public.issue_reward_gift_with_icon(p_member_id uuid,p_title text,p_terms text,p_reason text,p_category text,p_valid_until date,p_staff_id uuid,p_key uuid,p_icon text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_old_icon text;
BEGIN
 IF NOT public.staff_has_reward_permission(p_staff_id,'issue') THEN RAISE EXCEPTION 'Not authorised'; END IF;
 IF p_icon IS NULL OR p_icon NOT IN ('drink','food','gift','treat') THEN RAISE EXCEPTION 'Choose a valid reward icon'; END IF;
 PERFORM id FROM public.members WHERE id=p_member_id FOR UPDATE;
 SELECT icon INTO v_old_icon FROM public.reward_gifts WHERE submission_key=p_key;
 IF FOUND AND v_old_icon<>p_icon THEN RAISE EXCEPTION 'Submission key already used'; END IF;
 v_id:=public.issue_reward_gift(p_member_id,p_title,p_terms,p_reason,p_category,p_valid_until,p_staff_id,p_key);
 UPDATE public.reward_gifts SET icon=p_icon WHERE id=v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.issue_reward_gift_with_icon(uuid,text,text,text,text,date,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.issue_reward_gift_with_icon(uuid,text,text,text,text,date,uuid,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.mark_reward_seen(p_member_id uuid,p_gift_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.reward_gifts SET seen_at=coalesce(seen_at,now()) WHERE member_id=p_member_id AND id=p_gift_id;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.mark_reward_seen(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mark_reward_seen(uuid,uuid) TO service_role;
COMMIT;
