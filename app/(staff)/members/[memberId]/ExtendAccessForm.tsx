"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { membershipDate } from "@/lib/format/date";
function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="club-button-secondary disabled:opacity-50"
    >
      {pending ? "Extending access…" : "Confirm complimentary extension"}
    </button>
  );
}
export function ExtendAccessForm({
  action,
  memberId,
  passId,
  currentEnd,
  minEnd,
  submissionKey,
}: {
  action: (data: FormData) => Promise<void>;
  memberId: string;
  passId: string;
  currentEnd: string;
  minEnd: string;
  submissionKey: string;
}) {
  const [newEnd, setNewEnd] = useState(minEnd);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="member_id" value={memberId} />
      <input type="hidden" name="pass_id" value={passId} />
      <input type="hidden" name="expected_end" value={currentEnd} />
      <input type="hidden" name="submission_key" value={submissionKey} />
      <p>
        Current expiry: <strong>{membershipDate(currentEnd)}</strong> · 10 pm
        Jamaica time.
      </p>
      <label htmlFor={`extend-date-${passId}`} className="block">
        New expiration date
      </label>
      <input
        id={`extend-date-${passId}`}
        name="new_end"
        type="date"
        min={minEnd}
        max="9999-12-31"
        required
        value={newEnd}
        onChange={(e) => setNewEnd(e.target.value)}
        className="oura-input block w-full p-3"
      />
      {newEnd && (
        <p role="status">
          Access will end on <strong>{membershipDate(newEnd)}</strong> at 10 pm
          Jamaica time.
        </p>
      )}
      <label htmlFor={`extend-reason-${passId}`} className="block">
        Reason for complimentary extension
      </label>
      <textarea
        id={`extend-reason-${passId}`}
        name="reason"
        required
        minLength={3}
        maxLength={500}
        className="oura-input w-full p-3"
        placeholder="For example: approved courtesy extension"
      />
      <p className="text-muted-foreground">
        The same facilities and discounts continue. The original payment stays
        unchanged; this extension is complimentary.
      </p>
      <Submit />
    </form>
  );
}
