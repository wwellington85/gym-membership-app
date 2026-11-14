-- Guests reserve a time, while physical cabana assignments stay with staff.
CREATE FUNCTION public.request_member_experience(p_actor uuid,p_member uuid,p_key uuid,p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_payload jsonb; v_date date; v_start integer; v_cabana integer; v_old public.experience_bookings%ROWTYPE; candidate record;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.members WHERE id=p_member AND user_id=p_actor AND is_active) THEN RAISE EXCEPTION 'Active member required'; END IF;
 -- Keep the same key/member/day lock order as the underlying booking RPC.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text,1));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_member::text,2));
 v_payload:=p_payload||jsonb_build_object('cabana',null);
 SELECT * INTO v_old FROM public.experience_bookings WHERE submission_key=p_key;
 IF FOUND THEN
  -- Replay the original payload, even after a staff reschedule changes the row.
  IF v_old.created_by<>p_actor OR v_old.member_id IS DISTINCT FROM p_member OR v_old.source<>'member' OR (v_old.request_payload-'cabana')<>(v_payload-'cabana') THEN RAISE EXCEPTION 'Submission changed; refresh and try again'; END IF;
  RETURN v_old.id;
 END IF;
 IF v_payload->>'product'='starlight' THEN
  RETURN public.create_experience_booking(p_actor,p_member,'member',p_key,v_payload);
 END IF;
 v_date:=(v_payload->>'date')::date; v_start:=(v_payload->>'start')::integer;
 IF v_date IS NULL OR v_start IS NULL OR v_start NOT BETWEEN 420 AND 840 OR v_start%30<>0 OR v_start BETWEEN 601 AND 659 THEN RAISE EXCEPTION 'Choose an available four-hour slot'; END IF;
 -- Lock all three resources in a fixed order before choosing one. Staff's
 -- explicit booking/reschedule locks use the identical day/resource key.
 FOR v_cabana IN 1..3 LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(v_date::text||':'||v_cabana::text,3));
 END LOOP;
 -- Fill compatible established schedules first, preserving untouched cabanas
 -- for requests whose preferred start differs from the existing day anchors.
 FOR candidate IN
  SELECT n AS cabana,d.first_start FROM generate_series(1,3) n
  LEFT JOIN public.cabana_days d ON d.booking_date=v_date AND d.cabana=n
  WHERE (d.first_start IS NULL OR v_start IN (d.first_start,d.first_start+240))
   AND NOT EXISTS(SELECT 1 FROM public.experience_bookings b WHERE b.booking_date=v_date AND b.cabana=n AND b.start_minute=v_start AND b.status IN ('requested','confirmed','completed'))
  ORDER BY (d.first_start IS NULL),n
 LOOP
  RETURN public.create_experience_booking(p_actor,p_member,'member',p_key,v_payload||jsonb_build_object('cabana',candidate.cabana));
 END LOOP;
 RAISE EXCEPTION 'Slot just booked; choose another';
END $$;
REVOKE ALL ON FUNCTION public.request_member_experience(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_member_experience(uuid,uuid,uuid,jsonb) TO service_role;
