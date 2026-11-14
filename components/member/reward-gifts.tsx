import Link from "next/link";
import { giftStatus, type RewardGift } from "@/lib/rewards/gifts";
import { membershipDate } from "@/lib/format/date";
export function RewardGifts({
  gifts,
  error,
  active,
}: {
  gifts: RewardGift[];
  error: boolean;
  active: boolean;
}) {
  const ready = gifts.filter((g) => giftStatus(g) === "available"),
    history = gifts.filter((g) => giftStatus(g) !== "available");
  const card = (g: RewardGift) => {
    const status = giftStatus(g);
    return (
      <article key={g.id} className="oura-card space-y-2 p-4">
        <div className="flex justify-between gap-3">
          <h3 className="font-medium">{g.title}</h3>
          <span className="text-xs capitalize">
            {status === "available" ? "Ready to use" : status}
          </span>
        </div>
        {g.terms && <p className="text-sm">{g.terms}</p>}
        <p className="text-xs text-muted-foreground">
          {status === "redeemed"
            ? "Redeemed · thank you for visiting."
            : `Use by ${membershipDate(g.valid_until)} at 10 pm`}
        </p>
        {active && status === "available" && (
          <Link
            href={`/member/rewards/${g.id}`}
            className="club-button-secondary"
          >
            Use this reward
          </Link>
        )}
      </article>
    );
  };
  return (
    <section
      id="member-rewards"
      className="space-y-3"
      aria-label="Your rewards"
    >
      <h2 className="font-semibold">A little thank-you.</h2>
      <p className="text-sm text-muted-foreground">
        Selected gifts from the Travellers team. Visit points recognise your
        visits; they do not automatically unlock a gift.
      </p>
      {error ? (
        <p role="status">Your rewards could not be loaded. Please try again.</p>
      ) : (
        <>
          {!ready.length && (
            <p className="text-sm">Rewards chosen for you will appear here.</p>
          )}
          {ready.map(card)}
          {history.length > 0 && (
            <details className="space-y-3">
              <summary className="cursor-pointer py-2 text-sm">
                Reward history ({history.length})
              </summary>
              {history.map(card)}
            </details>
          )}
        </>
      )}
    </section>
  );
}
