# Home hierarchy and restaurant menus

Home now follows a task-focused order: compact welcome, membership/card access, restaurant menus and bookings shortcuts, relevant next-booking/gift updates, bookable experiences, compact visit progress, and an eligible pass invitation. The full plan carousel, four-row discount list and generic property gallery have been removed from Home. Full benefits remain in Benefits and plan details remain on the access page. Monthly members, including complimentary and scheduled monthly passes, receive no upgrade offer.

The membership summary uses the same highest-current-product selection as the premium card. It shows the actual restaurant discount only when positive. Free members see a short points message; inactive accounts receive assistance language. Upcoming access remains explicitly scheduled. Home updates filter all service-client queries to the signed-in member; bookings must be confirmed and in the future, and rewards must be available before their expiration cutoff. An independent update lookup failure leaves the other update available and surfaces a link to the full pages.

“Book an experience” replaces “Make a day of it.” Cards explicitly say “Cabana rentals,” “Four hours by the pool,” and “Private beach dinner for two,” with availability actions. The Starlight detail introduction also states that it is a private beach dinner for two. Rewards/rankings links wrap with a proper gap. Achievement detail is available on visit history and rankings. The property photos now support the restaurant menu header and an Around Travellers guide linked from Benefits.

## Restaurant menus

Home → Restaurant menus opens `/member/dining`, with Breakfast, Lunch and Dinner selectors and category links. The existing four bottom-navigation destinations remain unchanged. The restaurant's ordinary dinner menu is separate from the Starlight booking menu.

The maintained source is the existing website:

- https://tbr.travel/breakfast-menu/
- https://tbr.travel/lunch-menu/
- https://tbr.travel/dinner-menu/

A server-only Cheerio parser extracts text from the known menu containers. It includes dish descriptions, explicit vegetarian markers, price variants, beverages, individual/bulk sides, seasonal information, accompaniment notes, allergy wording and the restaurant's pricing note. It never renders website HTML/CSS/scripts and never infers dietary eligibility from a dish name. The published Primavera shrimp description remains unchanged pending the team's confirmation.

Only the three allowlisted source URLs can be fetched. Valid parsed results are cached for 15 minutes; the cache does not add requests to Home rendering. Source failures retain the last successful cached menu for up to a day. Older cached data triggers an awaited fresh fetch. When current data cannot be verified, the page offers the original menu website rather than inventing prices or rendering an empty menu. Source requests have a six-second timeout. No ordering or payment flow is added.

Live-source verification on 15 November 2026 found 26 breakfast items including drinks/sides, 27 lunch items including sides and 26 dinner items, with all published price options preserved. Menu prices remain the restaurant's published prices; membership discounts are not silently applied to them.

## Typography

Archivo remains the production typeface throughout the app, with a lighter welcome heading and clearer hierarchy. A side-by-side local preview uses the actual updated Home component with example data to compare the Archivo layout with Newsreader on only the welcome and experience headings. The Newsreader subset is embedded only in that preview; it adds no production font request. The typeface decision can be made from this concrete comparison.

## Validation

Tests cover Home order and member-type behavior, menu parsing across different item/sides formats, explicit diet markers, multiple prices, seasonal notes, source-layout failures, stale/unavailable source handling, allowlisted meal selection, and ownership/time/status filters on Home updates. Existing access, booking, reward, card, staff and payment checks continue to run. No account, points, payment or booking data is mutated by this change. Real-phone visual review remains manual.
