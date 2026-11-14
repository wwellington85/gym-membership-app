# Visit rewards: pilot and redemption proposal

Prepared 14 November 2026. These are proposed rules for review, not published entitlements or activated rewards. Current app changes improve member experience and explain that redemption is coming later.

## Comparable models

- [Nando’s Rewards](https://www.nandos.co.uk/rewards) awards a Chilli for a day with qualifying spending of at least £7, with food rewards at 3, 6 and 10 Chillies. Its daily earning unit resembles a visit, but it is backed by a purchase. This distinction matters for Travellers: a gate/gym visit currently earns credit without verifying restaurant spending.
- [Costa Club](https://www.costa.co.uk/costa-club/how-to-guides) uses a simple purchased-drink counter: ten beans earn a free drink, and the member selects the earned reward in the app. The useful pattern is an understandable small reward target, not the assumption that property attendance has the same economics as a drink purchase.
- [Chick-fil-A’s redemption guide](https://www.chick-fil-a.com/customer-support/chick-fil-a-one-membership-program/points-and-rewards/what-are-chick-fil-a-one-rewards-and-how-do-i-redeem-them) lets a member choose a reward, then use it in an order or redeem by scanning their app QR in person. Travellers should bind a selected reward to a specific server-side claim and consume it once; the ordinary membership QR should not independently authorize free items.

## Recommended starting pilot

Keep the established earning rule: 3 points for a verified property visit, once per day. All active free, approved Local Rewards and paid/complimentary Club members can earn. Do not present points as a proxy for money spent.

| Proposed reward | Points | Equivalent visits | Suggested scope |
|---|---:|---:|---|
| One selected cocktail, mocktail or dessert | 30 | 10 | First pilot; one item chosen from a costed reward menu. Offer a non-alcoholic choice. |
| One selected appetizer | 60 | 20 | Add after checking pilot costs and demand. |
| Quarterly meal recognition | Separate invitation | Review sustained visits within the quarter | Management approves selected regular customers; one issued meal offer per person per quarter. Do not automatically award meals solely for gym attendance. |

The 30-point figure is a proposed starting target, not a validated margin calculation. Cost the selected recipes/portions first. If a reward's direct cost is C, its cost per earning visit is C/10. For example, a hypothetical $3 direct cost spreads over ten visits at $0.30 per visit; that does not demonstrate profit because a visit may generate no restaurant sale. Use the highest cost among the member's reward choices when setting a fulfilment budget.

Today's balances could support up to 13 thirty-point claims if everyone chose only that option. That gives an initial budget estimate of 13 × the direct item cost, before future earning. Honour the existing earned points rather than resetting visit history. Review actual reward cost, repeat restaurant visits and staff workload after an initial 6–8 week pilot; revenue uplift cannot be measured reliably until purchases are connected.

For quarterly recognition, management could review members with at least 20 distinct visit days in that quarter and use restaurant-team knowledge to choose regular diners. This is a candidate-review rule, not an automatic promise. Use a selected meal or a stated value cap, a defined redemption window and one offer per quarter. Keep this invitation separate from the points shop so redeeming a drink does not erase loyalty progress. Restaurant purchase confirmation can replace subjective selection later.

## Proposed member and staff flow

1. Benefits shows points available, points held for pending claims, and rewards with their actual point prices and terms. It also keeps lifetime visits/points earned distinct from spending balance.
2. The member chooses an item and confirms the points cost. The authenticated server checks membership, balance, catalogue availability and limits, then reserves those points and creates a reward-specific claim. The reward name and point price are frozen for that claim.
3. The app displays a QR tied to the claim and member, with a short expiry. A reasonable initial design is a ten-minute reservation with a short-lived rotating QR. This is separate from the normal membership-card QR.
4. Authorized restaurant/front desk staff scan it, see the member/item/points, verify the person and availability, then explicitly confirm fulfilment. The member cannot mark their own reward redeemed.
5. One database transaction locks the claim and points account, validates the token, active membership, reservation and any quarterly/cooldown limit, consumes the claim and writes a single points debit plus staff fulfilment/audit record. Retrying the same request cannot deduct points or grant the item twice.
6. The member sees Redeemed in history and the new available balance. A used voucher is permanently unusable. A repeatable catalogue reward may become available again once the member has sufficient unreserved points and meets its limits; a quarterly invitation remains unavailable until a new quarter's offer is issued.
7. Expired/cancelled unfulfilled claims release held points. Simply opening a QR must not permanently cost points. After actual fulfilment, any reversal requires an audited staff action, not client-side deletion.

Start with no more than one fulfilled points reward per member per day; tune any further cooldown against the pilot budget rather than silently adding restrictions later. Published terms should define selected items, exclusions, alcohol/non-alcoholic options, availability, any purchase requirement and offer expiration before activation.

## Data and integrity requirements

- An append-only points ledger supports credits, debits and audited reversals; available points equal earned/adjusted credits minus completed spending and active holds. Existing check-ins remain the earning history and are never deleted to simulate spending.
- Rank and lifetime visit badges do not fall when a member redeems points.
- A reward catalogue stores active dates, point prices, item choices and any per-member limits. Draft rewards remain private until approved and costed.
- Claims hold a member, reward snapshot, point cost, status, expiry and one-use token reference. Unique submission/claim keys and locking prevent simultaneous claims from overspending or staff scans from being replayed. Store token hashes and validate tokens on the server.
- Quarterly recognition uses a unique member/quarter issuance guard and a separate one-use claim; it does not reset earned points or grant facility access.
- Staff fulfilment stores the actual actor, timestamp, claim and item. Receipt/bill references can be added without pretending to track spend totals. Reward use must not generate an extra visit or points automatically.
- Initial migration must reconcile and import opening earned balances once. Existing points are preserved; a migration must not credit the same history repeatedly.

Before activating a catalogue, confirm direct reward costs, selected menu items, redemption limits and how quarterly invitations are chosen. No reward values or QR claiming endpoints have been activated by the current UX release.
