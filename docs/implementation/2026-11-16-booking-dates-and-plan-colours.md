# Booking date defaults and plan comparison

The Home welcome again includes “Make yourself at home.” Plan cards use restrained product-specific colours: gym day in grey, resort day in teal, weekly in blue, and monthly in champagne/gold. This applies to access-plan comparisons, current passes and the existing upgrade carousel. Names, prices, dates and entitlements remain explicit; colour is supplementary.

## Member booking flow

Guest booking pages default to the next date with requestable time slots. Cabana availability combines all three resources and respects the established two-slot daily schedules and active holds. Dinner defaults use the existing full 24-hour notice rule; tomorrow is not offered when both dinner times fall inside that notice period. Dinner dates and times remain requests subject to staff availability checks.

The form order is date → time → package, followed by the remaining details. The automatically selected date is explained beside the date field. Changing or clearing it hides the previous form; loading feedback replaces stale times until navigation completes. A chosen time is retained when switching between Classic and Premium cabana packages. Changing between cabanas and dinner still clears incompatible times.

An explicit valid date is preserved, including a sold-out cabana date. Empty dates show a date-specific message and a Find next date action instead of an empty time selector and unusable booking form. The search action advances from the chosen date. Search respects the same one-year booking horizon as the database and ends with a clear choose-another-date/front-desk message. The date validator rejects normalized impossible dates such as February 31.

Cabana calendar reads use 31-day batches: at most 93 anchors and 186 occupied slots per batch under the current three-resource/two-slot constraints. This avoids both per-day request loops and silently truncated annual responses at PostgREST's row cap. Only dates, cabana IDs and times are loaded; no guest names or contact information are exposed. Exact row counts also detect lower/custom API truncation limits. Query errors or incomplete results fail closed rather than inventing availability. Viewing or changing dates does not hold inventory; the existing transactional request function remains authoritative at submission.

The operational staff calendar continues to open on today's schedule so staff can manage today's reservations. Guest defaults and their minimum selectable date use resort time and existing operating hours. No scheduling, pricing, membership, payment or reward database mutation is part of this release.

## Validation

Tests cover closing-time and exact-cutoff behavior, dinner notice across local midnight, sold-out and partially available days, all three resources, held/confirmed/completed inventory filters, month-batch boundaries, exhausted horizons, database failures, automatic date navigation and empty-state recovery. Existing booking transaction, member-type, menu, card, staff and payment tests run as part of the suite. Real-phone visual review remains manual.
