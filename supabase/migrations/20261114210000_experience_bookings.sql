-- A shared, service-only inventory for member requests and front-desk bookings.
CREATE TABLE public.experience_products (
 code text PRIMARY KEY, name text NOT NULL, price numeric(10,2) NOT NULL CHECK(price>=0),
 currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'), tax_rate numeric NOT NULL DEFAULT 0,
 service_rate numeric NOT NULL DEFAULT 0, inclusions text[] NOT NULL, active boolean NOT NULL DEFAULT true
);
INSERT INTO public.experience_products(code,name,price,tax_rate,service_rate,inclusions) VALUES
 ('cabana_classic','Cabana · Classic',80,0,0,ARRAY['Four hours in a private cabana','Dedicated server and cooling mist fan','One bottle of champagne or wine','Four beers of choice','Four Premium Discovery Waters']),
 ('cabana_premium','Cabana · Premium',140,0,0,ARRAY['Four hours in a private cabana','Dedicated server and cooling mist fan','One bottle of Appleton or Smirnoff','Two Red Bull and two cranberry juices','Four Premium Discovery Waters','Wings and fries appetizer']),
 ('starlight','Starlight Dinner for two',140,.10,.10,ARRAY['Private beach setting and dedicated service','Full-course dinner for two','Wine','Menu preselection']);
CREATE TABLE public.cabana_days (
 booking_date date NOT NULL, cabana integer NOT NULL CHECK(cabana BETWEEN 1 AND 3),
 first_start integer NOT NULL CHECK(first_start BETWEEN 420 AND 600 AND first_start%30=0),
 PRIMARY KEY(booking_date,cabana)
);
CREATE TABLE public.experience_bookings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_id uuid REFERENCES public.members(id),
 created_by uuid NOT NULL, source text NOT NULL CHECK(source IN ('member','staff')),
 product_code text NOT NULL REFERENCES public.experience_products(code),
 booking_date date NOT NULL, start_minute integer NOT NULL, end_minute integer,
 cabana integer CHECK(cabana BETWEEN 1 AND 3),
 guest_name text NOT NULL CHECK(length(guest_name) BETWEEN 1 AND 120),
 email text NOT NULL DEFAULT '' CHECK(length(email)<=254), phone text NOT NULL DEFAULT '' CHECK(length(phone)<=40),
 room text NOT NULL DEFAULT '' CHECK(length(room)<=40), occasion text NOT NULL DEFAULT '' CHECK(length(occasion)<=100),
 menu jsonb NOT NULL DEFAULT '[]', dietary_notes text NOT NULL DEFAULT '' CHECK(length(dietary_notes)<=2000),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
 product_snapshot jsonb NOT NULL, total numeric(10,2) NOT NULL CHECK(total>=0), currency text NOT NULL CHECK(currency='USD'),
 status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','confirmed','completed','cancelled','declined')),
 paid_at timestamptz, payment_method text CHECK(payment_method IN ('cash','card','room_charge','bank_transfer')),
 payment_reference text, paid_by uuid, refunded_at timestamptz, refunded_by uuid, refund_reference text,
 confirmed_by uuid, confirmed_at timestamptz, cancellation_reason text,
 submission_key uuid NOT NULL UNIQUE, request_payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), revision integer NOT NULL DEFAULT 0,
 CHECK((product_code LIKE 'cabana_%' AND cabana IS NOT NULL AND end_minute IS NOT NULL AND end_minute=start_minute+240 AND start_minute BETWEEN 420 AND 840)
 OR (product_code='starlight' AND cabana IS NULL AND start_minute IN (1080,1200) AND end_minute IS NULL)),
 CHECK((paid_at IS NULL AND paid_by IS NULL AND payment_method IS NULL) OR (paid_at IS NOT NULL AND paid_by IS NOT NULL AND payment_method IS NOT NULL)),
 CHECK(refunded_at IS NULL OR paid_at IS NOT NULL)
);
-- Held requests count against inventory until the desk or guest releases them.
CREATE UNIQUE INDEX experience_cabana_slot ON public.experience_bookings(booking_date,cabana,start_minute)
 WHERE cabana IS NOT NULL AND status IN ('requested','confirmed','completed');
CREATE INDEX experience_booking_queue ON public.experience_bookings(status,booking_date,start_minute);
CREATE INDEX experience_booking_member ON public.experience_bookings(member_id,booking_date DESC);

CREATE FUNCTION public.validate_dinner_menu(p_menu jsonb) RETURNS boolean
 LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE person jsonb;
BEGIN
 IF jsonb_typeof(p_menu) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(p_menu)<>2 THEN RETURN false; END IF;
 FOR person IN SELECT value FROM jsonb_array_elements(p_menu) LOOP
  IF jsonb_typeof(person) IS DISTINCT FROM 'object'
   OR coalesce(person->>'appetizer','') NOT IN ('Fish Cake','Chicken Kebab','Veggie Wrap')
   OR coalesce(person->>'salad','') NOT IN ('Caesar Salad','Tossed Salad','Cob Salad')
   OR coalesce(person->>'main','') NOT IN ('Cajun Shrimp','Parmesan Chicken','Traditional Jerk Fish in foil','Garlic Lobster','Strip Loin Steak','Travellers Veggie Bowl')
   OR coalesce(person->>'dessert','') NOT IN ('Travellers Rocky Road','Tropical Fruit Salad')
   OR jsonb_typeof(person->'sides') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(person->'sides')<>2 OR person->'sides'->>0=person->'sides'->>1 THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(person->'sides') s WHERE s NOT IN ('Grill Pumpkin & Potato','Herb Mash Potato','Vegetable Rice')) THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;

CREATE FUNCTION public.create_experience_booking(p_actor uuid,p_member uuid,p_source text,p_key uuid,p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_product public.experience_products%ROWTYPE; v_old public.experience_bookings%ROWTYPE;
 v_date date; v_start integer; v_cabana integer; v_anchor integer; v_id uuid; v_staff boolean; v_name text; v_email text; v_phone text;
BEGIN
 v_staff:=EXISTS(SELECT 1 FROM public.staff_profiles WHERE user_id=p_actor AND is_active AND role IN ('admin','supervisor','front_desk'));
 IF p_source IS NULL OR p_source NOT IN ('member','staff') OR (p_source='staff' AND NOT v_staff) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_source='member' AND NOT EXISTS(SELECT 1 FROM public.members WHERE id=p_member AND user_id=p_actor AND is_active) THEN RAISE EXCEPTION 'Active member required'; END IF;
 -- Serialize duplicate submissions before looking up their outcome.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text,1));
 SELECT * INTO v_old FROM public.experience_bookings WHERE submission_key=p_key;
 IF FOUND THEN
  IF v_old.created_by<>p_actor OR v_old.member_id IS DISTINCT FROM p_member OR v_old.source<>p_source OR v_old.request_payload<>p_payload THEN RAISE EXCEPTION 'Submission changed; refresh and try again'; END IF;
  RETURN v_old.id;
 END IF;
 IF p_source='member' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_member::text,2));
  IF (SELECT count(*) FROM public.experience_bookings WHERE member_id=p_member AND status='requested' AND booking_date>=(now() AT TIME ZONE 'America/Jamaica')::date)>=3 THEN RAISE EXCEPTION 'Please contact the front desk before making another request'; END IF;
  SELECT full_name,email,phone INTO v_name,v_email,v_phone FROM public.members WHERE id=p_member;
 ELSE
  v_name:=trim(p_payload->>'guest_name'); v_email:=trim(coalesce(p_payload->>'email','')); v_phone:=trim(coalesce(p_payload->>'phone',''));
  IF p_member IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.members WHERE id=p_member AND is_active) THEN RAISE EXCEPTION 'Active member required'; END IF;
  IF coalesce(v_email,'')='' AND coalesce(v_phone,'')='' AND trim(coalesce(p_payload->>'room',''))='' THEN RAISE EXCEPTION 'Provide a phone, email or room number'; END IF;
 END IF;
 SELECT * INTO v_product FROM public.experience_products WHERE code=p_payload->>'product' AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Package unavailable'; END IF;
 v_date:=(p_payload->>'date')::date; v_start:=(p_payload->>'start')::integer;
 IF v_date IS NULL OR v_start IS NULL OR v_date>(now() AT TIME ZONE 'America/Jamaica')::date+365 OR (v_date+make_interval(mins=>v_start)) AT TIME ZONE 'America/Jamaica'<=now() THEN RAISE EXCEPTION 'Choose a future date and time within the next year'; END IF;
 IF v_product.code='starlight' THEN
  IF v_start NOT IN (1080,1200) OR (v_date+make_interval(mins=>v_start)) AT TIME ZONE 'America/Jamaica'<now()+interval '24 hours' THEN RAISE EXCEPTION 'Dinner requires at least 24 hours notice'; END IF;
  IF NOT public.validate_dinner_menu(p_payload->'menu') THEN RAISE EXCEPTION 'Select a complete menu for both guests'; END IF;
 ELSE
  v_cabana:=(p_payload->>'cabana')::integer;
  IF v_cabana IS NULL OR v_cabana NOT BETWEEN 1 AND 3 OR v_start NOT BETWEEN 420 AND 840 OR v_start%30<>0 OR v_start BETWEEN 601 AND 659 THEN RAISE EXCEPTION 'Choose an available four-hour slot'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_date::text||':'||v_cabana::text,3));
  INSERT INTO public.cabana_days(booking_date,cabana,first_start) VALUES(v_date,v_cabana,CASE WHEN v_start<=600 THEN v_start ELSE v_start-240 END) ON CONFLICT DO NOTHING;
  SELECT first_start INTO v_anchor FROM public.cabana_days WHERE booking_date=v_date AND cabana=v_cabana;
  IF v_start<>v_anchor AND v_start<>v_anchor+240 THEN RAISE EXCEPTION 'Schedule changed; choose an available slot'; END IF;
  IF EXISTS(SELECT 1 FROM public.experience_bookings WHERE booking_date=v_date AND cabana=v_cabana AND start_minute=v_start AND status IN ('requested','confirmed','completed')) THEN RAISE EXCEPTION 'Slot just booked; choose another'; END IF;
 END IF;
 INSERT INTO public.experience_bookings(member_id,created_by,source,product_code,booking_date,start_minute,end_minute,cabana,guest_name,email,phone,room,occasion,menu,dietary_notes,notes,product_snapshot,total,currency,submission_key,request_payload)
 VALUES(p_member,p_actor,p_source,v_product.code,v_date,v_start,CASE WHEN v_cabana IS NULL THEN NULL ELSE v_start+240 END,v_cabana,v_name,coalesce(v_email,''),coalesce(v_phone,''),trim(coalesce(p_payload->>'room','')),trim(coalesce(p_payload->>'occasion','')),CASE WHEN v_cabana IS NULL THEN p_payload->'menu' ELSE '[]'::jsonb END,trim(coalesce(p_payload->>'dietary_notes','')),trim(coalesce(p_payload->>'notes','')),to_jsonb(v_product),round(v_product.price*(1+v_product.tax_rate+v_product.service_rate),2),v_product.currency,p_key,p_payload) RETURNING id INTO v_id;
 INSERT INTO public.club_audit_events(actor_id,member_id,action,detail) VALUES(p_actor,p_member,'experience_requested',jsonb_build_object('booking_id',v_id,'product',v_product.code,'date',v_date,'cabana',v_cabana,'start',v_start,'source',p_source));
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.manage_experience_booking(p_actor uuid,p_booking uuid,p_action text,p_detail jsonb DEFAULT '{}')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.experience_bookings%ROWTYPE; v_staff boolean; v_date date; v_start integer; v_cabana integer; v_anchor integer;
BEGIN
 v_staff:=EXISTS(SELECT 1 FROM public.staff_profiles WHERE user_id=p_actor AND is_active AND role IN ('admin','supervisor','front_desk'));
 SELECT * INTO b FROM public.experience_bookings WHERE id=p_booking FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Booking unavailable'; END IF;
 IF NOT v_staff THEN
  IF p_action IS DISTINCT FROM 'cancel' OR NOT EXISTS(SELECT 1 FROM public.members WHERE id=b.member_id AND user_id=p_actor) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF b.status='cancelled' THEN RETURN; END IF;
  IF b.status<>'requested' OR b.paid_at IS NOT NULL THEN RAISE EXCEPTION 'Contact the front desk to change a confirmed or paid booking'; END IF;
 ELSE
  IF p_action IN ('cancel','decline','refund') AND length(trim(coalesce(p_detail->>'reason','')))<3 THEN RAISE EXCEPTION 'Give a reason'; END IF;
 END IF;
 IF p_detail ? 'expected_revision' AND (p_detail->>'expected_revision')::integer IS DISTINCT FROM b.revision THEN RAISE EXCEPTION 'Booking changed; refresh before continuing'; END IF;
 IF p_action='reschedule' THEN
  IF b.status NOT IN ('requested','confirmed') THEN RAISE EXCEPTION 'Booking is no longer open'; END IF;
  v_date:=(p_detail->>'date')::date; v_start:=(p_detail->>'start')::integer;
  IF v_date IS NULL OR v_start IS NULL OR v_date>(now() AT TIME ZONE 'America/Jamaica')::date+365 OR (v_date+make_interval(mins=>v_start)) AT TIME ZONE 'America/Jamaica'<=now() THEN RAISE EXCEPTION 'Choose a future date and time within the next year'; END IF;
  IF b.cabana IS NULL THEN
   IF v_start NOT IN (1080,1200) OR (v_date+make_interval(mins=>v_start)) AT TIME ZONE 'America/Jamaica'<now()+interval '24 hours' THEN RAISE EXCEPTION 'Dinner requires at least 24 hours notice'; END IF;
   IF b.status='confirmed' AND p_detail->>'availability_checked' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Check dinner setup and kitchen availability first'; END IF;
  ELSE
   v_cabana:=(p_detail->>'cabana')::integer;
   IF v_cabana IS NULL OR v_cabana NOT BETWEEN 1 AND 3 OR v_start NOT BETWEEN 420 AND 840 OR v_start%30<>0 OR v_start BETWEEN 601 AND 659 THEN RAISE EXCEPTION 'Choose an available four-hour slot'; END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended(v_date::text||':'||v_cabana::text,3));
   INSERT INTO public.cabana_days(booking_date,cabana,first_start) VALUES(v_date,v_cabana,CASE WHEN v_start<=600 THEN v_start ELSE v_start-240 END) ON CONFLICT DO NOTHING;
   SELECT first_start INTO v_anchor FROM public.cabana_days WHERE booking_date=v_date AND cabana=v_cabana;
   IF v_start<>v_anchor AND v_start<>v_anchor+240 THEN RAISE EXCEPTION 'Schedule changed; choose an available slot'; END IF;
   IF EXISTS(SELECT 1 FROM public.experience_bookings WHERE id<>b.id AND booking_date=v_date AND cabana=v_cabana AND start_minute=v_start AND status IN ('requested','confirmed','completed')) THEN RAISE EXCEPTION 'Slot just booked; choose another'; END IF;
  END IF;
  UPDATE public.experience_bookings SET booking_date=v_date,start_minute=v_start,end_minute=CASE WHEN b.cabana IS NULL THEN NULL ELSE v_start+240 END,cabana=v_cabana,revision=revision+1,updated_at=now() WHERE id=b.id;
 ELSIF p_action='menu' THEN
  IF b.status NOT IN ('requested','confirmed') OR b.cabana IS NOT NULL THEN RAISE EXCEPTION 'Booking is no longer open'; END IF;
  IF NOT public.validate_dinner_menu(p_detail->'menu') THEN RAISE EXCEPTION 'Select a complete menu for both guests'; END IF;
  UPDATE public.experience_bookings SET menu=p_detail->'menu',dietary_notes=coalesce(p_detail->>'dietary_notes',''),revision=revision+1,updated_at=now() WHERE id=b.id;
 ELSIF p_action='pay' THEN
  IF b.status NOT IN ('requested','confirmed') THEN RAISE EXCEPTION 'Booking is no longer open'; END IF;
  IF b.paid_at IS NOT NULL THEN RETURN; END IF;
  IF (p_detail->>'amount')::numeric IS DISTINCT FROM b.total OR p_detail->>'currency' IS DISTINCT FROM b.currency THEN RAISE EXCEPTION 'Payment must match the booking total'; END IF;
  IF coalesce(p_detail->>'method','') NOT IN ('cash','card','room_charge','bank_transfer') OR length(trim(coalesce(p_detail->>'reference',''))) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Provide payment method and receipt reference'; END IF;
  UPDATE public.experience_bookings SET paid_at=now(),paid_by=p_actor,payment_method=p_detail->>'method',payment_reference=trim(p_detail->>'reference'),revision=revision+1,updated_at=now() WHERE id=b.id;
 ELSIF p_action='confirm' THEN
  IF b.status='confirmed' THEN RETURN; END IF;
  IF b.status<>'requested' OR b.paid_at IS NULL OR b.refunded_at IS NOT NULL THEN RAISE EXCEPTION 'Record payment before confirming'; END IF;
  IF b.product_code='starlight' AND p_detail->>'availability_checked' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Check dinner setup and kitchen availability first'; END IF;
  IF b.booking_date<(now() AT TIME ZONE 'America/Jamaica')::date OR (b.cabana IS NOT NULL AND (b.booking_date+make_interval(mins=>b.end_minute)) AT TIME ZONE 'America/Jamaica'<=now()) THEN RAISE EXCEPTION 'Booking time has passed'; END IF;
  UPDATE public.experience_bookings SET status='confirmed',confirmed_at=now(),confirmed_by=p_actor,revision=revision+1,updated_at=now() WHERE id=b.id;
 ELSIF p_action IN ('cancel','decline') THEN
  IF b.status=(CASE WHEN p_action='cancel' THEN 'cancelled' ELSE 'declined' END) THEN RETURN; END IF;
  IF b.status NOT IN ('requested','confirmed') OR (p_action='decline' AND b.status<>'requested') THEN RAISE EXCEPTION 'Booking is no longer open'; END IF;
  UPDATE public.experience_bookings SET status=CASE WHEN p_action='cancel' THEN 'cancelled' ELSE 'declined' END,cancellation_reason=CASE WHEN v_staff THEN left(trim(p_detail->>'reason'),1000) ELSE 'Cancelled by guest' END,revision=revision+1,updated_at=now() WHERE id=b.id;
 ELSIF p_action='refund' THEN
  IF b.paid_at IS NULL OR b.status NOT IN ('cancelled','declined') THEN RAISE EXCEPTION 'Cancel booking before recording a refund'; END IF;
  IF b.refunded_at IS NOT NULL THEN RETURN; END IF;
  IF length(trim(coalesce(p_detail->>'reference',''))) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Provide refund receipt reference'; END IF;
  UPDATE public.experience_bookings SET refunded_at=now(),refunded_by=p_actor,refund_reference=trim(p_detail->>'reference'),revision=revision+1,updated_at=now() WHERE id=b.id;
 ELSIF p_action='complete' THEN
  IF b.status='completed' THEN RETURN; END IF;
  IF b.status<>'confirmed' OR (b.booking_date+make_interval(mins=>b.start_minute)) AT TIME ZONE 'America/Jamaica'>now() THEN RAISE EXCEPTION 'Complete a confirmed booking after it starts'; END IF;
  UPDATE public.experience_bookings SET status='completed',revision=revision+1,updated_at=now() WHERE id=b.id;
 ELSE RAISE EXCEPTION 'Unknown action'; END IF;
 INSERT INTO public.club_audit_events(actor_id,member_id,action,detail) VALUES(p_actor,b.member_id,'experience_'||p_action,jsonb_build_object('booking_id',b.id,'detail',p_detail));
END $$;

ALTER TABLE public.experience_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cabana_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.experience_products,public.cabana_days,public.experience_bookings FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.experience_products,public.cabana_days,public.experience_bookings TO service_role;
REVOKE ALL ON FUNCTION public.validate_dinner_menu(jsonb),public.create_experience_booking(uuid,uuid,text,uuid,jsonb),public.manage_experience_booking(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_dinner_menu(jsonb),public.create_experience_booking(uuid,uuid,text,uuid,jsonb),public.manage_experience_booking(uuid,uuid,text,jsonb) TO service_role;
