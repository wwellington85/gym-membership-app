BEGIN;
SET LOCAL lock_timeout = '5s';

-- Preserve historical gateway statuses while accepting the new fulfilled status.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending','succeeded','paid','failed','canceled','refunded'));

-- Receipts no longer renew memberships. Dated access is granted atomically by
-- grant_staff_access / fulfil_access_payment, and Rewards identity stays separate.
-- Leave all access/payment audit triggers and all foreign-key checks intact.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.payments'::regclass
      AND tgname = 'trg_payments_apply_to_membership' AND NOT tgisinternal) THEN
    ALTER TABLE public.payments DISABLE TRIGGER trg_payments_apply_to_membership;
  END IF;
END $$;

-- Keep older receipt consumers accurate without rewriting historical payments.
CREATE OR REPLACE FUNCTION public.sync_payment_receipt_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.payment_method IS NOT NULL THEN NEW.method := NEW.payment_method; END IF;
  IF NEW.paid_on IS NOT NULL THEN NEW.payment_date := NEW.paid_on; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_payment_receipt_fields ON public.payments;
CREATE TRIGGER sync_payment_receipt_fields
  BEFORE INSERT OR UPDATE OF payment_method, paid_on ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_payment_receipt_fields();

COMMIT;
