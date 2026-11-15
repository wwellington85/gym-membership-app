# Membership card finishes

One shared digital card design with the existing favicon’s TC geometry in a finish-specific single-ink treatment, static fine-line sun/wave artwork, inset edging and finishes keyed to the active product code:

- Free account: pearl and champagne, navy text.
- Local Rewards: jade with warm satin accents.
- Gym day: brushed silver blue.
- Resort day: coastal blue.
- Weekly: deep navy and silver blue.
- Monthly: midnight navy with warm gold engraving and edging.

The card uses the highest currently usable pass, prioritizing monthly, weekly, resort day and gym day. A lower product with a later expiry does not override a current monthly card. Future, expired and revoked passes are excluded. Complimentary and purchased passes with the same product have the same design. Local Rewards approval supplies the jade finish when there is no current paid/complimentary facility pass. Inactive accounts show a neutral verification card.

The product name and its own access expiry remain explicit; the visual finish grants no benefits and changes no account data. The existing live QR stays in its separate white scanning panel. All decorative artwork is inline SVG/CSS with no new images, fonts, motion or network requests. Unknown products fall back to a neutral finish, rather than inferring a premium tier from a display name.

Validation includes existing card and QR behavior, active-tier priority, future/expired exclusions and inactive fallback. Text contrast was checked against gradient endpoints; real-phone visual checking remains manual.

The circular serif monogram and lower-right decorative seal have been removed. A shared inline `ClubMark` uses the same paths and cutouts as the branded favicon, with unique mask IDs so several cards can render safely together.
