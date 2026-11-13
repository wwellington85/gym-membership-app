-- Legacy payment rules observed in the gym database. No member data.
ALTER TABLE memberships ADD COLUMN last_payment_date date, ADD COLUMN needs_contact boolean DEFAULT false;
ALTER TABLE payments
  ALTER COLUMN membership_id SET NOT NULL,
  ADD COLUMN payment_date date NOT NULL DEFAULT current_date,
  ADD COLUMN method text NOT NULL DEFAULT 'cash',
  ADD CONSTRAINT payments_status_check CHECK (status IN ('pending','succeeded','failed','canceled','refunded')),
  ADD CONSTRAINT payments_provider_fields_check CHECK ((provider IS NULL AND provider_payment_id IS NULL) OR (provider IS NOT NULL AND provider_reference IS NOT NULL AND (lower(status)='pending' OR provider_payment_id IS NOT NULL)));
CREATE OR REPLACE FUNCTION public.payments_apply_to_membership()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_days int;
  v_current_paid_through date;
  v_start_date date;
  v_base date;
  v_new_paid_through date;
  v_has_prior_payments boolean;
begin
  -- Get membership dates + plan duration
  select m.paid_through_date, m.start_date, p.duration_days
    into v_current_paid_through, v_start_date, v_days
  from public.memberships m
  join public.membership_plans p on p.id = m.plan_id
  where m.id = new.membership_id;

  if v_days is null then
    raise exception 'Could not resolve duration_days for membership_id %', new.membership_id;
  end if;

  -- Determine if this membership already has a payment before this insert
  select exists (
    select 1
    from public.payments p
    where p.membership_id = new.membership_id
      and p.id <> new.id
  )
  into v_has_prior_payments;

  -- Base-date rules:
  -- 1) First payment: base from start_date (or paid_on if paid_on is later)
  -- 2) Subsequent payments: extend from later of current paid_through and paid_on
  if not v_has_prior_payments then
    v_base := greatest(coalesce(v_start_date, new.paid_on), new.paid_on);
  else
    v_base := greatest(coalesce(v_current_paid_through, new.paid_on), new.paid_on);
  end if;

  v_new_paid_through := (v_base + (v_days || ' days')::interval)::date;

  update public.memberships
  set
    paid_through_date = v_new_paid_through,
    last_payment_date = new.paid_on,
    needs_contact = false,
    status = case
      when v_new_paid_through < current_date then 'past_due'
      when v_new_paid_through <= (current_date + 3) then 'due_soon'
      else 'active'
    end
  where id = new.membership_id;

  return new;
end
$function$
;
CREATE TRIGGER trg_payments_apply_to_membership AFTER INSERT ON payments FOR EACH ROW EXECUTE FUNCTION payments_apply_to_membership();
