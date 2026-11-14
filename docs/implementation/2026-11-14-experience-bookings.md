# Cabana rentals and Starlight Dinner

Guests use the two experience cards on Home, then choose a date, package and time. My bookings is linked from Home, the experience page and Account. Staff use Overview → Cabanas & dinner, or the desktop sidebar. Admins, supervisors and front-desk staff can manage bookings; security cannot.

## Cabana schedule

Three independent cabanas, 7 am–6 pm, four-hour sessions. The first held request establishes a pair of consecutive sessions for that cabana/date. Half-hour starts from 7–10 am and 11 am–2 pm preserve room for both sessions. For example, a 9 am first request creates 9 am–1 pm and 1–5 pm. A 1 pm first request establishes those same two sessions. The anchor persists through cancellations so the published day does not shift. There is no setup gap between sessions in this version.

Requests hold inventory immediately until cancelled by the guest or staff; holds do not expire automatically. Staff should clear abandoned requests in Needs attention. Members can have at most three pending future requests. Day advisory locks serialize new reservations and rescheduling, and an active-slot unique index provides a second collision guard. Row locks and revision checks protect staff mutations from stale forms. An unsuccessful reschedule leaves the original booking unchanged.

Classic is seeded at US$80 and Premium at US$140, based on the supplied flyer, treating its dollar prices as USD. Package contents match the flyer. The requested 7 am–6 pm hours supersede the flyer’s 9 am–5 pm hours. No promotion expiry has been invented. Prices are stored in a service-only product catalogue and frozen into each booking; changes to future pricing cannot alter an existing receipt.

## Dinner

Source reviewed 14 November 2026: [Starlight booking page](https://tbr.travel/starlightdinner/). US$140 per couple plus separate 10% tax and 10% service charge gives US$168 per booking. Arrival options are 6 pm and 8 pm, with at least 24 hours’ notice. No dinner end time or table capacity is assumed.

Two individual menus allow identical selections for both guests. Each person chooses an appetizer, salad, main, two distinct sides and dessert. Dietary notes and occasion are retained and visible to the team. The selectable dishes follow the online booking form. The [linked PDF](https://tbr.travel/wp-content/uploads/2025/10/Starlight-menu-new.pdf) differs (it adds banana flambé and omits shrimp), so those PDF-only choices are not offered. Seasonal availability and table/kitchen capacity require explicit staff review before confirmation. A confirmed dinner move requires that check again.

## Front-desk workflow

1. Review an app request, or hold a walk-in/phone booking. Walk-ins need a name and phone, email or room number. An optional membership number links a desk booking to an existing account; no account is created automatically.
2. Collect payment at the desk or post a room charge. Record the exact frozen total, method and receipt reference. This does not charge a card or invoke the membership payment provider.
3. Confirm the booking. Dinner also requires an availability acknowledgement. Guests see its updated status in My bookings.
4. Staff can reschedule, change a dinner menu, mark attendance completed, or cancel. Cancellation releases cabana inventory but does not mark money refunded.
5. Process any full refund outside the app, then record its reference. Paid cancellations remain in Refund review until recorded. Partial refunds and online payment are outside this version.

Bookings create no facility passes, visits, points or automatic rewards. This feature does not send booking emails or push notifications. Guest confirmation is displayed in My bookings; staff handle direct coordination with the provided contact details. Existing reward push remains unchanged.

All tables have RLS and no anon/authenticated grants. Service-only RPCs validate actor roles or member ownership independently. Guest reads filter the signed-in member; client-supplied ownership is ignored. Guest cancellation is limited to their own unpaid request. Booking operations are audited with staff/guest actor IDs. No production test bookings or receipts are inserted during rollout.

## Assets and verification

Two supplied photos converted to WebP: 109,018-byte cabana image and 49,680-byte dinner image, lazy-loaded with responsive sizes. No original large photos or flyer are shipped.

Meaningful database tests exercise collision handling, stable day anchors, cancellation/rebooking, request idempotency, role boundaries, lead time, per-person menu validation, frozen prices, payment/confirmation/refund order, atomic rescheduling, stale revision rejection, and separation from access passes and points. Rendering/action tests cover guest privacy, time options and session-derived ownership. Real-phone visual testing remains a manual follow-up.
