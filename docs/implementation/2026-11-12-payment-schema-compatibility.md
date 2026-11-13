# Staff access and legacy payment schema compatibility

## Cause

The deployed access routines use payment status `paid`, while the pre-existing gym database `payments_status_check` accepted only pending, succeeded, failed, canceled, and refunded. A staff pass grant therefore rolled back before any access was created. The previous regression fixture omitted this constraint and the older receipt columns/trigger, so it did not catch the incompatibility.

The legacy `trg_payments_apply_to_membership` trigger also extended membership dates on every receipt insertion, independently of payment state. That behavior conflicts with independent dated access passes and could alter Rewards dates during pending checkout creation.

## Fix

Apply `20261112210000_payment_schema_compatibility.sql` to the gym database only. The migration retains all existing allowed payment statuses and adds `paid`, disables only the obsolete automatic membership-extension trigger, and synchronizes payment_method/paid_on into the older method/payment_date receipt columns. Foreign keys, access permissions, audit triggers, and historical records remain intact. It grants no customer access.

Staff copy now says “Grant, sell or renew access” and “Grant complimentary access” when the complimentary method is selected. Failed grant logs include the error code and message, without form notes or database error details.

## Verification and operations

- Updated the database regression fixture with the legacy constraint, required columns, provider constraint, and payment-insert trigger observed in the gym database.
- Reproduced the original error and verified no partial receipt/pass remains. After the migration, a complimentary monthly pass yields one $0 receipt, the correct duration, preserved Rewards records, an access audit event, and idempotent retries. Existing payment fulfilment tests run against these legacy constraints too.
- Live gym verification used a synthetic member inside a transaction ending in ROLLBACK. Monthly grant, receipt, duration, retry protection, unchanged Rewards record, and audit assertions passed. No test records or real member access were committed.
- 64 tests, ESLint, TypeScript, and production build pass. The migration was applied directly to gym project `bdnwjalcopncpccdnivn`; the portal database was not involved. Schema/trigger metadata was backed up privately before application.

Do not re-enable the old membership-extension trigger while dated access passes remain authoritative. Do not tighten the status constraint back to the older list after new `paid` receipts exist without reconciling them first. Historical pending receipts have not been reclassified or replayed.
