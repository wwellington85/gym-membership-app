BEGIN;

-- Loyalty identity belongs to members; access is independently dated and retained.
ALTER TABLE public.memberships ALTER COLUMN paid_through_date DROP NOT NULL;
ALTER TABLE public.membership_plans ADD COLUMN IF NOT EXISTS access_scope text;
UPDATE public.membership_plans SET access_scope = CASE WHEN NOT grants_access THEN 'none' WHEN code IN ('club_day','club_weekly','club_monthly_95') THEN 'resort' ELSE 'gym' END WHERE access_scope IS NULL;
ALTER TABLE public.membership_plans ADD CONSTRAINT membership_plans_access_scope_check CHECK (access_scope IN ('none','gym','resort'));


ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS purchased_plan_id uuid REFERENCES public.membership_plans(id),
  ADD COLUMN IF NOT EXISTS access_start_date date,
  ADD COLUMN IF NOT EXISTS access_end_date date,
  ADD COLUMN IF NOT EXISTS purchase_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz,
  ADD COLUMN IF NOT EXISTS checkout_key uuid,
  ADD COLUMN IF NOT EXISTS waiver_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS waiver_version text;
-- New checkout metadata is trusted server data, never member-supplied table writes.
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon, authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS payments_checkout_key_uq ON public.payments(member_id, checkout_key) WHERE checkout_key IS NOT NULL;

CREATE TABLE public.access_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id),
  plan_id uuid NOT NULL REFERENCES public.membership_plans(id),
  payment_id uuid UNIQUE REFERENCES public.payments(id),
  start_date date NOT NULL,
  paid_through_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  plan_snapshot jsonb NOT NULL,
  source text NOT NULL DEFAULT 'purchase',
  staff_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (paid_through_date >= start_date)
);
CREATE INDEX access_passes_member_dates_idx ON public.access_passes(member_id, paid_through_date);
ALTER TABLE public.access_passes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.access_passes FROM anon, authenticated;
GRANT SELECT ON public.access_passes TO authenticated;
GRANT ALL ON public.access_passes TO service_role;
CREATE POLICY access_passes_member_read ON public.access_passes FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.user_id = auth.uid())
);

-- Preserve existing paid access exactly; do not guess whether old day purchases
-- represented gym-only access. Review historical anomalies before correcting them.
INSERT INTO public.access_passes (member_id, plan_id, start_date, paid_through_date, plan_snapshot, source)
SELECT m.member_id, p.id, m.start_date, m.paid_through_date, to_jsonb(p) || jsonb_build_object('benefits',coalesce((SELECT jsonb_agg(jsonb_build_object('label',b.label,'value',b.value) ORDER BY b.sort_order,b.id) FROM public.membership_plan_benefits b WHERE b.plan_id=p.id AND b.is_active),'[]'::jsonb)), 'legacy'
FROM public.memberships m JOIN public.membership_plans p ON p.id = m.plan_id
WHERE p.grants_access AND p.code <> 'rewards_free' AND m.status IN ('active','due_soon')
  AND m.start_date IS NOT NULL AND m.paid_through_date >= m.start_date;

UPDATE public.membership_plans SET price = 25, name = 'Travellers Resort Day Pass', access_scope = 'resort' WHERE code = 'club_day';
INSERT INTO public.membership_plans (code, name, price, duration_days, plan_type, grants_access, access_scope, is_active, visible_on_join, discount_food, discount_spa, discount_giftshop, discount_watersports)
SELECT 'gym_day', 'Gym Day Access', 15, 1, 'pass', true, 'gym', true, true, discount_food, discount_spa, discount_giftshop, discount_watersports
FROM public.membership_plans WHERE code = 'rewards_free'
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price, duration_days = EXCLUDED.duration_days, grants_access = EXCLUDED.grants_access, access_scope = EXCLUDED.access_scope,
  discount_food = EXCLUDED.discount_food, discount_spa = EXCLUDED.discount_spa, discount_giftshop = EXCLUDED.discount_giftshop, discount_watersports = EXCLUDED.discount_watersports;


-- New orders have a frozen product and service period. Old pending checkouts are
-- intentionally not guessed: their price/product/date may be ambiguous.
-- The service role is the only caller; signature and captured amount are checked
-- at the HTTP boundary AND amount/currency are checked again under the row lock.
CREATE OR REPLACE FUNCTION public.fulfil_access_payment(
  p_payment_id uuid, p_transaction_id text, p_reference text, p_amount numeric, p_currency text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_pass uuid;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_transaction_id, 0));
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND OR v_payment.provider IS DISTINCT FROM 'fygaro' THEN RAISE EXCEPTION 'Unknown checkout'; END IF;
  IF p_transaction_id IS NULL OR length(p_transaction_id) = 0 OR p_amount IS DISTINCT FROM v_payment.amount OR upper(p_currency) IS DISTINCT FROM upper(v_payment.currency) THEN RAISE EXCEPTION 'Payment does not match checkout'; END IF;
  IF v_payment.fulfilled_at IS NOT NULL THEN
    IF v_payment.provider_payment_id IS DISTINCT FROM p_transaction_id THEN RAISE EXCEPTION 'Transaction mismatch'; END IF;
    SELECT id INTO v_pass FROM public.access_passes WHERE payment_id = p_payment_id;
    RETURN v_pass;
  END IF;
  IF v_payment.purchased_plan_id IS NULL OR v_payment.purchase_snapshot IS NULL OR v_payment.access_start_date IS NULL OR v_payment.access_end_date IS NULL THEN RAISE EXCEPTION 'Legacy checkout requires front desk reconciliation'; END IF;
  IF EXISTS (SELECT 1 FROM public.payments WHERE provider = 'fygaro' AND provider_payment_id = p_transaction_id AND id <> p_payment_id) THEN RAISE EXCEPTION 'Transaction already assigned'; END IF;
  -- Serialize separate payments for this member as well as retries of this order.
  PERFORM id FROM public.members WHERE id = v_payment.member_id FOR UPDATE;
  INSERT INTO public.access_passes (member_id, plan_id, payment_id, start_date, paid_through_date, plan_snapshot)
  VALUES (v_payment.member_id, v_payment.purchased_plan_id, p_payment_id, v_payment.access_start_date, v_payment.access_end_date, v_payment.purchase_snapshot)
  RETURNING id INTO v_pass;
  UPDATE public.payments SET status = 'paid', provider_payment_id = p_transaction_id,
    provider_reference = p_reference, paid_on = (now() AT TIME ZONE 'America/Jamaica')::date,
    payment_method = 'fygaro', fulfilled_at = now() WHERE id = p_payment_id;
  -- No update to legacy membership dates: payment-insert triggers cannot grant
  -- extra days, and loyalty identity never becomes a time-limited pass.
  RETURN v_pass;
END $$;
REVOKE ALL ON FUNCTION public.fulfil_access_payment(uuid,text,text,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfil_access_payment(uuid,text,text,numeric,text) TO service_role;

-- Staff sale/assignment is one transaction, including optional receipt. A unique
-- submission key prevents accidental repeat sales; access is never silently
-- inferred merely by recording a standalone payment.
CREATE OR REPLACE FUNCTION public.grant_staff_access(
  p_member_id uuid, p_plan_id uuid, p_start date, p_record_payment boolean,
  p_method text, p_amount numeric, p_notes text, p_staff_id uuid, p_key uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_plan public.membership_plans%ROWTYPE;
  v_membership uuid;
  v_payment uuid;
  v_pass uuid;
  v_end date;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff_profiles WHERE user_id = p_staff_id AND role IN ('admin','front_desk') AND is_active IS NOT FALSE) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = p_member_id AND is_active) THEN RAISE EXCEPTION 'Member is inactive'; END IF;
  SELECT * INTO v_plan FROM public.membership_plans WHERE id = p_plan_id AND is_active;
  IF NOT FOUND OR NOT v_plan.grants_access OR v_plan.duration_days NOT BETWEEN 1 AND 3649 THEN RAISE EXCEPTION 'Select a paid access product'; END IF;
  IF p_start IS NULL OR p_amount IS NULL OR p_amount < 0 OR (p_record_payment AND coalesce(p_method,'') = '') THEN RAISE EXCEPTION 'Invalid sale details'; END IF;
  PERFORM id FROM public.members WHERE id = p_member_id FOR UPDATE;
  SELECT id INTO v_pass FROM public.access_passes WHERE source = 'staff:' || p_key::text AND member_id = p_member_id;
  IF v_pass IS NOT NULL THEN RETURN v_pass; END IF;
  v_end := p_start + (v_plan.duration_days - 1);
  SELECT id INTO v_membership FROM public.memberships WHERE member_id = p_member_id LIMIT 1;
  IF p_record_payment THEN
    INSERT INTO public.payments (member_id, membership_id, amount, currency, paid_on, payment_method, staff_user_id, notes, status, purchased_plan_id, purchase_snapshot, access_start_date, access_end_date, fulfilled_at, checkout_key)
    VALUES (p_member_id, v_membership, p_amount, 'USD', (now() AT TIME ZONE 'America/Jamaica')::date, p_method, p_staff_id, p_notes, 'paid', p_plan_id, to_jsonb(v_plan), p_start, v_end, now(), p_key)
    RETURNING id INTO v_payment;
  END IF;
  INSERT INTO public.access_passes (member_id, plan_id, payment_id, start_date, paid_through_date, plan_snapshot, source, staff_user_id)
  VALUES (p_member_id, p_plan_id, v_payment, p_start, v_end, to_jsonb(v_plan) || jsonb_build_object('benefits',coalesce((SELECT jsonb_agg(jsonb_build_object('label',b.label,'value',b.value) ORDER BY b.sort_order,b.id) FROM public.membership_plan_benefits b WHERE b.plan_id=v_plan.id AND b.is_active),'[]'::jsonb)), 'staff:' || p_key::text, p_staff_id) RETURNING id INTO v_pass;
  RETURN v_pass;
END $$;
REVOKE ALL ON FUNCTION public.grant_staff_access(uuid,uuid,date,boolean,text,numeric,text,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_staff_access(uuid,uuid,date,boolean,text,numeric,text,uuid,uuid) TO service_role;


CREATE OR REPLACE FUNCTION public.record_gym_visit(p_member_id uuid, p_staff_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_points integer; v_today date := (now() AT TIME ZONE 'America/Jamaica')::date;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff_profiles WHERE user_id = p_staff_id AND role IN ('admin','front_desk','security') AND is_active IS NOT FALSE) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  PERFORM id FROM public.members WHERE id = p_member_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member is inactive'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.access_passes a WHERE a.member_id = p_member_id AND a.status = 'active'
    AND a.plan_snapshot->>'access_scope' IN ('gym','resort')
    AND a.start_date <= v_today AND (a.paid_through_date > v_today OR (a.paid_through_date = v_today AND (now() AT TIME ZONE 'America/Jamaica')::time < time '22:00'))) THEN RAISE EXCEPTION 'No valid gym access'; END IF;
  IF EXISTS (SELECT 1 FROM public.checkins WHERE member_id = p_member_id AND (checked_in_at AT TIME ZONE 'America/Jamaica')::date = v_today) THEN RETURN false; END IF;
  SELECT greatest(0, int_value) INTO v_points FROM public.app_settings WHERE key = 'points_per_checkin';
  INSERT INTO public.checkins(member_id, staff_user_id, points_earned) VALUES (p_member_id, p_staff_id, coalesce(v_points,1));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.record_gym_visit(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_gym_visit(uuid,uuid) TO service_role;

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
    WHERE (coalesce(p_query,'') = '' OR m.full_name ILIKE '%' || p_query || '%' OR m.phone ILIKE '%' || p_query || '%' OR m.email ILIKE '%' || p_query || '%' OR replace(m.id::text,'-','') = replace(regexp_replace(p_query,'^TC-','','i'),'-',''))
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


ALTER TABLE public.members ADD COLUMN IF NOT EXISTS enrolment_key uuid UNIQUE;
CREATE OR REPLACE FUNCTION public.enrol_club_member(p_name text, p_phone text, p_email text, p_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_member uuid; v_free uuid;
BEGIN
  IF nullif(trim(p_name),'') IS NULL OR p_key IS NULL THEN RAISE EXCEPTION 'Member details required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,1));
  SELECT id INTO v_member FROM public.members WHERE enrolment_key = p_key;
  IF v_member IS NOT NULL THEN RETURN v_member; END IF;
  SELECT id INTO v_free FROM public.membership_plans WHERE code = 'rewards_free';
  IF v_free IS NULL THEN RAISE EXCEPTION 'Rewards plan is not configured'; END IF;
  INSERT INTO public.members(full_name, phone, email, enrolment_key) VALUES (p_name, p_phone, lower(p_email), p_key) RETURNING id INTO v_member;
  INSERT INTO public.memberships(member_id, plan_id, status, start_date, paid_through_date)
  VALUES(v_member,v_free,'active',(now() AT TIME ZONE 'America/Jamaica')::date,NULL) ON CONFLICT(member_id) DO NOTHING;
  RETURN v_member;
END $$;
REVOKE ALL ON FUNCTION public.enrol_club_member(text,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enrol_club_member(text,text,text,uuid) TO service_role;

CREATE TABLE public.club_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, member_id uuid REFERENCES public.members(id),
  action text NOT NULL, detail jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.club_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_audit_events FROM anon, authenticated;
GRANT ALL ON public.club_audit_events TO service_role;
CREATE OR REPLACE FUNCTION public.revoke_access_pass(p_pass_id uuid, p_member_id uuid, p_staff_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff_profiles WHERE user_id = p_staff_id AND role = 'admin' AND is_active IS NOT FALSE) OR length(trim(p_reason)) < 3 THEN RAISE EXCEPTION 'Not authorised or missing reason'; END IF;
  UPDATE public.access_passes SET status = 'revoked' WHERE id = p_pass_id AND member_id = p_member_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Pass not found'; END IF;
  INSERT INTO public.club_audit_events(actor_id,member_id,action,detail) VALUES(p_staff_id,p_member_id,'pass_revoked',jsonb_build_object('pass_id',p_pass_id,'reason',p_reason));
END $$;
REVOKE ALL ON FUNCTION public.revoke_access_pass(uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_access_pass(uuid,uuid,uuid,text) TO service_role;


CREATE OR REPLACE FUNCTION public.search_club_payments(p_query text,p_status text,p_from date,p_to date,p_page integer,p_size integer)
RETURNS TABLE(id uuid,member_id uuid,full_name text,amount numeric,currency text,status text,provider text,payment_method text,created_at timestamptz,fulfilled_at timestamptz,total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id,coalesce(p.member_id,ms.member_id),m.full_name::text,p.amount::numeric,coalesce(p.currency,'USD')::text,p.status::text,p.provider::text,p.payment_method::text,p.created_at,p.fulfilled_at,count(*) OVER()
  FROM public.payments p LEFT JOIN public.memberships ms ON ms.id = p.membership_id JOIN public.members m ON m.id = coalesce(p.member_id,ms.member_id)
  WHERE (coalesce(p_query,'') = '' OR m.full_name ILIKE '%' || p_query || '%' OR m.email ILIKE '%' || p_query || '%' OR m.phone ILIKE '%' || p_query || '%' OR p.id::text = p_query)
    AND (p_from IS NULL OR (p.created_at AT TIME ZONE 'America/Jamaica')::date >= p_from)
    AND (p_to IS NULL OR (p.created_at AT TIME ZONE 'America/Jamaica')::date <= p_to)
    AND CASE p_status WHEN 'pending' THEN p.status = 'pending' WHEN 'paid' THEN p.status = 'paid' OR p.status IS NULL WHEN 'needs_review' THEN p.status = 'paid' AND p.provider = 'fygaro' AND p.fulfilled_at IS NULL WHEN 'failed' THEN p.status IN ('failed','cancelled','canceled') ELSE true END
  ORDER BY p.created_at DESC,p.id LIMIT least(greatest(p_size,1),5000) OFFSET greatest(p_page,0)*least(greatest(p_size,1),5000)
$$;
REVOKE ALL ON FUNCTION public.search_club_payments(text,text,date,date,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.search_club_payments(text,text,date,date,integer,integer) TO service_role;


CREATE OR REPLACE FUNCTION public.apply_due_programme_updates()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_update public.membership_plan_scheduled_updates%ROWTYPE; v_count integer := 0;
BEGIN
  FOR v_update IN SELECT * FROM public.membership_plan_scheduled_updates WHERE applied_at IS NULL AND effective_on <= (now() AT TIME ZONE 'America/Jamaica')::date ORDER BY effective_on,created_at,id FOR UPDATE SKIP LOCKED LOOP
    UPDATE public.membership_plans SET
      discount_food = coalesce(v_update.discount_food,discount_food), discount_spa = coalesce(v_update.discount_spa,discount_spa),
      discount_giftshop = coalesce(v_update.discount_giftshop,discount_giftshop), discount_watersports = coalesce(v_update.discount_watersports,discount_watersports),
      grants_access = coalesce(v_update.grants_access,grants_access), visible_on_join = coalesce(v_update.visible_on_join,visible_on_join)
    WHERE id = v_update.plan_id;
    UPDATE public.membership_plan_scheduled_updates SET applied_at = now() WHERE id = v_update.id;
    INSERT INTO public.club_audit_events(action,detail) VALUES('programme_schedule_applied',jsonb_build_object('schedule_id',v_update.id,'plan_id',v_update.plan_id));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.apply_due_programme_updates() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_due_programme_updates() TO service_role;

CREATE OR REPLACE FUNCTION public.audit_club_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row jsonb := to_jsonb(NEW); v_member uuid; v_actor uuid;
BEGIN
  v_actor := auth.uid();
  IF TG_TABLE_NAME = 'access_passes' THEN v_member := NEW.member_id; v_actor := NEW.staff_user_id;
  ELSIF TG_TABLE_NAME = 'members' THEN
    IF OLD.is_active IS NOT DISTINCT FROM NEW.is_active THEN RETURN NEW; END IF;
    v_member := NEW.id;
  END IF;
  INSERT INTO public.club_audit_events(actor_id,member_id,action,detail) VALUES(v_actor,v_member,TG_TABLE_NAME || '_' || lower(TG_OP),
    jsonb_build_object('record_id',v_row->>'id','source',v_row->>'source','status',v_row->>'status','is_active',v_row->>'is_active'));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.audit_club_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER audit_access_pass AFTER INSERT OR UPDATE ON public.access_passes FOR EACH ROW EXECUTE FUNCTION public.audit_club_change();
CREATE TRIGGER audit_member_state AFTER UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.audit_club_change();
CREATE TRIGGER audit_programme_plan AFTER UPDATE ON public.membership_plans FOR EACH ROW EXECUTE FUNCTION public.audit_club_change();
CREATE TRIGGER audit_programme_benefit AFTER INSERT OR UPDATE ON public.membership_plan_benefits FOR EACH ROW EXECUTE FUNCTION public.audit_club_change();

CREATE TABLE public.benefit_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_id uuid NOT NULL REFERENCES public.members(id),
  outlet text NOT NULL CHECK (outlet IN ('restaurant','spa','giftshop','watersports')),
  bill_reference text NOT NULL, discount_percent numeric NOT NULL,
  staff_user_id uuid NOT NULL, submission_key uuid NOT NULL UNIQUE,
  used_on date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Jamaica')::date,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(outlet,bill_reference,used_on)
);
ALTER TABLE public.benefit_uses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.benefit_uses FROM anon,authenticated;
GRANT ALL ON public.benefit_uses TO service_role;
CREATE INDEX benefit_uses_member_time_idx ON public.benefit_uses(member_id,created_at);
CREATE OR REPLACE FUNCTION public.record_benefit_use(p_member_id uuid,p_outlet text,p_reference text,p_staff_id uuid,p_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_key text; v_rate numeric; v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff_profiles WHERE user_id=p_staff_id AND role IN ('admin','front_desk') AND is_active IS NOT FALSE) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id=p_member_id AND is_active) OR length(trim(p_reference)) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid member or bill reference'; END IF;
  v_key := CASE p_outlet WHEN 'restaurant' THEN 'discount_food' WHEN 'spa' THEN 'discount_spa' WHEN 'giftshop' THEN 'discount_giftshop' WHEN 'watersports' THEN 'discount_watersports' END;
  IF v_key IS NULL THEN RAISE EXCEPTION 'Unknown outlet'; END IF;
  SELECT id INTO v_id FROM public.benefit_uses WHERE submission_key=p_key AND member_id=p_member_id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT max(rate) INTO v_rate FROM (
    SELECT (to_jsonb(p)->>v_key)::numeric AS rate FROM public.membership_plans p WHERE p.code='rewards_free' AND p.is_active
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


CREATE OR REPLACE FUNCTION public.club_overview()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH access AS (
    SELECT DISTINCT ap.member_id FROM public.access_passes ap JOIN public.members m ON m.id = ap.member_id
    WHERE m.is_active AND ap.status = 'active' AND ap.start_date <= (now() AT TIME ZONE 'America/Jamaica')::date
      AND (ap.paid_through_date > (now() AT TIME ZONE 'America/Jamaica')::date OR (ap.paid_through_date = (now() AT TIME ZONE 'America/Jamaica')::date AND (now() AT TIME ZONE 'America/Jamaica')::time < time '22:00'))
  )
  SELECT jsonb_build_object('members',(SELECT count(*) FROM public.members WHERE is_active), 'access',(SELECT count(*) FROM access),
    'rewards_only',(SELECT count(*) FROM public.members m WHERE m.is_active AND NOT EXISTS (SELECT 1 FROM access a WHERE a.member_id=m.id)),
    'benefit_uses_30d',(SELECT count(*) FROM public.benefit_uses WHERE used_on >= (now() AT TIME ZONE 'America/Jamaica')::date - 29),
    'returning_benefit_members',(SELECT count(*) FROM (SELECT member_id FROM public.benefit_uses WHERE used_on >= (now() AT TIME ZONE 'America/Jamaica')::date - 29 GROUP BY member_id HAVING count(DISTINCT used_on)>1) returning_members),
    'visits_today',(SELECT count(*) FROM public.checkins WHERE (checked_in_at AT TIME ZONE 'America/Jamaica')::date = (now() AT TIME ZONE 'America/Jamaica')::date),
    'pending_requests',(SELECT count(*) FROM public.membership_applications WHERE status = 'pending'),
    'pending_payments',(SELECT count(*) FROM public.payments WHERE status = 'pending'),
    'activation_review',(SELECT count(*) FROM public.payments WHERE status = 'paid' AND provider='fygaro' AND fulfilled_at IS NULL))
$$;
REVOKE ALL ON FUNCTION public.club_overview() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.club_overview() TO service_role;


COMMIT;
