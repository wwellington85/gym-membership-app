"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { rewardPresets, type RewardIconName } from "@/lib/rewards/presets";
import { RewardIcon } from "@/components/rewards/reward-icon";
function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="club-button-secondary disabled:opacity-50"
    >
      {pending ? "Issuing gift…" : "Issue complimentary gift"}
    </button>
  );
}
export function IssueRewardForm({
  action,
  memberId,
  submissionKey,
  minDate,
  defaultDate,
}: {
  action: (data: FormData) => Promise<void>;
  memberId: string;
  submissionKey: string;
  minDate: string;
  defaultDate: string;
}) {
  const [quarterly, setQuarterly] = useState(false),
    [icon, setIcon] = useState<RewardIconName>("drink"),
    [title, setTitle] = useState<string>(rewardPresets[0].title),
    [terms, setTerms] = useState<string>(rewardPresets[0].terms);
  function choose(next: (typeof rewardPresets)[number]) {
    const previous = rewardPresets.find((p) => p.icon === icon)!;
    if (
      !title.trim() ||
      title === previous.title ||
      (quarterly && title === "One selected meal")
    )
      setTitle(next.title);
    if (
      !terms.trim() ||
      terms === previous.terms ||
      (quarterly && terms === "Choose one meal from the selected menu.")
    )
      setTerms(next.terms);
    if (next.icon !== "food") setQuarterly(false);
    setIcon(next.icon);
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="member_id" value={memberId} />
      <input type="hidden" name="submission_key" value={submissionKey} />
      <input type="hidden" name="icon" value={icon} />
      <input
        type="hidden"
        name="category"
        value={
          quarterly && icon === "food"
            ? "quarterly_meal"
            : icon === "gift"
              ? "other"
              : "treat"
        }
      />
      <fieldset>
        <legend className="mb-2 text-sm">Reward type</legend>
        <div className="grid grid-cols-4 gap-2">
          {rewardPresets.map((p) => (
            <button
              key={p.icon}
              type="button"
              aria-pressed={p.icon === icon}
              onClick={() => choose(p)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-sm ${p.icon === icon ? "border-primary bg-secondary text-primary" : ""}`}
            >
              <RewardIcon icon={p.icon} />
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block" htmlFor="gift-title">
        Reward / selected item
      </label>
      <input
        id="gift-title"
        name="title"
        required
        minLength={3}
        maxLength={120}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="oura-input w-full p-3"
      />
      {icon === "food" && (
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={quarterly}
            onChange={(e) => {
              const checked = e.target.checked;
              if (
                title === rewardPresets[1].title ||
                title === "One selected meal"
              )
                setTitle(
                  checked ? "One selected meal" : rewardPresets[1].title,
                );
              if (
                terms === rewardPresets[1].terms ||
                terms === "Choose one meal from the selected menu."
              )
                setTerms(
                  checked
                    ? "Choose one meal from the selected menu."
                    : rewardPresets[1].terms,
                );
              setQuarterly(checked);
            }}
            className="h-5 w-5"
          />
          Quarterly meal gift · one per member per quarter
        </label>
      )}
      <label className="block" htmlFor="gift-terms">
        Member-facing terms / selected menu items
      </label>
      <textarea
        id="gift-terms"
        name="terms"
        value={terms}
        onChange={(e) => setTerms(e.target.value)}
        maxLength={1000}
        className="oura-input w-full p-3"
      />
      <p className="text-xs text-muted-foreground">
        Suggested wording is editable. Changing reward types preserves your
        custom wording.
      </p>
      <label className="block" htmlFor="gift-expiry">
        Use by (10 pm)
      </label>
      <input
        id="gift-expiry"
        name="valid_until"
        type="date"
        required
        min={minDate}
        defaultValue={defaultDate}
        className="oura-input w-full p-3"
      />
      <label className="block" htmlFor="gift-issue-reason">
        Staff approval reason (private)
      </label>
      <textarea
        id="gift-issue-reason"
        name="reason"
        required
        minLength={3}
        maxLength={500}
        className="oura-input w-full p-3"
      />
      <Submit />
    </form>
  );
}
