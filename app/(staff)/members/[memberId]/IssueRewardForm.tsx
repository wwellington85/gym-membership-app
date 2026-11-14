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
  const [icon, setIcon] = useState<RewardIconName>("drink"),
    [title, setTitle] = useState<string>(rewardPresets[0].title),
    [terms, setTerms] = useState<string>(rewardPresets[0].terms);
  function choose(next: (typeof rewardPresets)[number]) {
    const previous = rewardPresets.find((p) => p.icon === icon)!;
    if (!title.trim() || title === previous.title) setTitle(next.title);
    if (!terms.trim() || terms === previous.terms) setTerms(next.terms);
    setIcon(next.icon);
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="member_id" value={memberId} />
      <input type="hidden" name="submission_key" value={submissionKey} />
      <input type="hidden" name="icon" value={icon} />
      <fieldset>
        <legend className="mb-2 text-sm">Choose a reward icon</legend>
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
      <label className="block" htmlFor="gift-category">
        Category
      </label>
      <select
        id="gift-category"
        name="category"
        className="oura-input w-full p-3"
      >
        <option value="treat">Treat</option>
        <option value="quarterly_meal">
          Quarterly meal (one per member per quarter)
        </option>
        <option value="other">Other gift</option>
      </select>
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
        Suggested wording is editable. Changing icons preserves your custom
        wording.
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
