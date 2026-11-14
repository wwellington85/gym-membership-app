BEGIN;
CREATE TABLE public.reward_gifts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_id uuid NOT NULL REFERENCES public.members(id),
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 3 AND 120),
 terms text NOT NULL CHECK(length(terms)<=1000), issue_reason text NOT NULL CHECK(length(trim(issue_reason)) BETWEEN 3 AND 500),
 category text NOT NULL CHECK(category IN ('treat','quarterly_meal','other')), recognition_quarter date,
 valid_until date NOT NULL, status text NOT NULL DEFAULT 'available' CHECK(status IN ('available','redeemed','revoked')),
 issued_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), submission_key uuid NOT NULL UNIQUE,
 redeemed_by uuid, redeemed_at timestamptz, revoke_reason text,
 CHECK((status='redeemed' AND redeemed_by IS NOT NULL AND redeemed_at IS NOT NULL) OR (status<>'redeemed' AND redeemed_by IS NULL AND redeemed_at IS NULL))
);
CREATE INDEX reward_gifts_member_time_idx ON public.reward_gifts(member_id,created_at DESC);
CREATE UNIQUE INDEX reward_gifts_quarterly_once ON public.reward_gifts(member_id,recognition_quarter) WHERE category='quarterly_meal' AND status<>'revoked';
ALTER TABLE public.reward_gifts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reward_gifts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.reward_gifts TO service_role;
CREATE OR REPLACE FUNCTION public.issue_reward_gift(p_member_id uuid,p_title text,p_terms text,p_reason text,p_category text,p_valid_until date,p_staff_id uuid,p_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_previous public.reward_gifts%ROWTYPE; v_today date := (now() AT TIME ZONE 'America/Jamaica')::date;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.staff_profiles WHERE user_id=p_staff_id AND role='admin' AND is_active IS NOT FALSE) THEN RAISE EXCEPTION 'Not authorised'; END IF;
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
 IF NOT EXISTS(SELECT 1 FROM public.staff_profiles WHERE user_id=p_staff_id AND role IN ('admin','front_desk') AND is_active IS NOT FALSE) THEN RAISE EXCEPTION 'Not authorised'; END IF;
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
 IF NOT EXISTS(SELECT 1 FROM public.staff_profiles WHERE user_id=p_staff_id AND role='admin' AND is_active IS NOT FALSE) OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Not authorised or missing reason'; END IF;
 PERFORM id FROM public.members WHERE id=p_member_id FOR UPDATE;
 UPDATE public.reward_gifts SET status='revoked',revoke_reason=trim(p_reason) WHERE id=p_gift_id AND member_id=p_member_id AND status='available';
 IF NOT FOUND THEN RAISE EXCEPTION 'Only an unused reward can be revoked'; END IF;
 INSERT INTO public.club_audit_events(actor_id,member_id,action,detail) VALUES(p_staff_id,p_member_id,'reward_gift_revoked',jsonb_build_object('gift_id',p_gift_id,'reason',trim(p_reason)));
END $$;
REVOKE ALL ON FUNCTION public.issue_reward_gift(uuid,text,text,text,text,date,uuid,uuid),public.redeem_reward_gift(uuid,uuid,uuid),public.revoke_reward_gift(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.issue_reward_gift(uuid,text,text,text,text,date,uuid,uuid),public.redeem_reward_gift(uuid,uuid,uuid),public.revoke_reward_gift(uuid,uuid,uuid,text) TO service_role;
COMMIT;
