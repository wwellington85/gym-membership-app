"use client";

import { useEffect, useMemo, useState } from "react";

type PlanCode = "rewards_free" | "club_day" | "club_weekly" | "club_monthly_95";

type Plan = {
  code: PlanCode;
  name: string;
  priceLabel: string;
  subtitle: string;
  highlights: string[];
};

const PLANS: Plan[] = [
  {
    code: "rewards_free",
    name: "Travellers Rewards",
    priceLabel: "Free",
    subtitle: "Discounts only (no facility access)",
    highlights: [
      "Restaurant & Bar: 5% off",
      "Spa services: 5% off",
      "Gift shop: 5% off",
      "Watersports: 5% off",
      "Earn points on eligible spend",
      "Complimentary high-speed Wi-Fi",
    ],
  },
  {
    code: "club_day",
    name: "Travellers Club Day Pass",
    priceLabel: "$25",
    subtitle: "Full access for 1 day",
    highlights: [
      "Gym access",
      "Pool + beach chairs/towels",
      "Lockers + showers",
      "Lounge access",
      "Restaurant & Bar: 10% off",
      "Spa services: 10% off",
      "Gift shop: 10% off",
      "Watersports: 10% off",
      "Complimentary high-speed Wi-Fi",
    ],
  },
  {
    code: "club_weekly",
    name: "Travellers Club Weekly Pass",
    priceLabel: "$45",
    subtitle: "Full access for 7 days",
    highlights: [
      "Gym access",
      "Pool + beach chairs/towels",
      "Lockers + showers",
      "Lounge access",
      "Restaurant & Bar: 15% off",
      "Spa services: 10% off",
      "Gift shop: 10% off",
      "Watersports: 10% off",
      "Complimentary high-speed Wi-Fi",
    ],
  },
  {
    code: "club_monthly_95",
    name: "Travellers Club Monthly",
    priceLabel: "$95",
    subtitle: "Full access for 30 days",
    highlights: [
      "Gym access",
      "Pool + beach chairs/towels",
      "Lockers + showers",
      "Lounge access",
      "Restaurant & Bar: 20% off",
      "Spa services: 15% off",
      "Gift shop: 15% off",
      "Watersports: 15% off",
      "Complimentary high-speed Wi-Fi",
    ],
  },
];

function cx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export function PlanPicker({
  name,
  defaultValue,
  currentPlan,
  showSubmit = false,
  submitLabel = "Continue",
}: {
  name: string;
  defaultValue: PlanCode;
  currentPlan?: PlanCode;
  showSubmit?: boolean;
  submitLabel?: string;
}) {
  const initial = useMemo<PlanCode>(() => defaultValue || "rewards_free", [defaultValue]);
  const [selected, setSelected] = useState<PlanCode>(initial);

  useEffect(() => setSelected(initial), [initial]);

  const isSameAsCurrent = !!currentPlan && selected === currentPlan;

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={selected} />

      <div className="grid gap-3">
        {PLANS.map((p) => {
          const isCurrent = !!currentPlan && currentPlan === p.code;

          // "Selected" should only apply to non-current plans the user is actively choosing
          const isChosen = selected === p.code;
          const isSelected = isChosen && !isCurrent;

          const baseCard = cx(
            "oura-card p-4 text-left w-full relative",
            "transition-[transform,box-shadow,border-color,opacity] duration-150",
            isCurrent
              ? "opacity-90 cursor-default border-[rgba(255,255,255,0.10)]"
              : "cursor-pointer opacity-90 border-[rgba(255,255,255,0.12)]",
            isSelected
              ? "opacity-100 ring-2 ring-[rgba(255,255,255,0.38)] shadow-[0_22px_80px_rgba(0,0,0,0.62)] border-[rgba(255,255,255,0.24)] border-l-4 border-l-[rgba(255,255,255,0.75)]"
              : ""
          );

          const hovery = isCurrent
            ? ""
            : "hover:opacity-100 hover:-translate-y-[1px] hover:shadow-[0_18px_60px_rgba(0,0,0,0.55)] hover:ring-1 hover:ring-[rgba(255,255,255,0.22)] active:scale-[0.995]";

          const CardTag: any = isCurrent ? "div" : "button";
          const cardProps = isCurrent
            ? { role: "group", "aria-disabled": true }
            : {
                type: "button",
                onClick: () => setSelected(p.code),
                "aria-pressed": isSelected,
              };

          return (
            <CardTag key={p.code} className={cx(baseCard, hovery)} {...cardProps}>
              {/* subtle “selected wash” */}
              {isSelected ? (
                <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[rgba(255,255,255,0.04)]" />
              ) : null}

              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold">{p.name}</div>

                    {isCurrent ? (
                      <span className="rounded-full border px-2 py-0.5 text-[11px] opacity-80">
                        Current
                      </span>
                    ) : null}

                    {isSelected ? (
                      <span className="rounded-full border px-2 py-0.5 text-[11px] opacity-95">
                        Selected
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-0.5 text-xs opacity-70">{p.subtitle}</div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="text-sm font-semibold whitespace-nowrap">{p.priceLabel}</div>

                  <div
                    className={cx(
                      "h-5 w-5 rounded-full border flex items-center justify-center",
                      isCurrent ? "opacity-55" : "",
                      isSelected
                        ? "border-[rgba(255,255,255,0.40)] shadow-[0_0_0_4px_rgba(255,255,255,0.10)]"
                        : "border-[rgba(255,255,255,0.16)]"
                    )}
                    aria-hidden="true"
                  >
                    {isSelected ? (
                      <div className="h-2.5 w-2.5 rounded-full bg-[rgb(var(--fg))]" />
                    ) : null}
                  </div>
                </div>
              </div>

              {/* subtle dividers instead of bullets */}
              <div className="relative mt-3 divide-y divide-white/10 text-xs">
                {p.highlights.map((h) => (
                  <div key={h} className="py-2 opacity-85">
                    {h}
                  </div>
                ))}
              </div>

              {isCurrent ? (
                <div className="relative mt-3 text-xs opacity-60">This is your current plan.</div>
              ) : null}
            </CardTag>
          );
        })}
      </div>

      {showSubmit ? (
        <button
          type="submit"
          disabled={isSameAsCurrent}
          className={cx(
            "w-full rounded border px-3 py-2 text-sm transition-opacity",
            isSameAsCurrent ? "opacity-50 cursor-not-allowed" : "hover:oura-surface-muted"
          )}
          title={isSameAsCurrent ? "Select a different plan to continue." : undefined}
        >
          {submitLabel}
        </button>
      ) : (
        <div className="text-xs opacity-70">
          Select a plan, then press <span className="font-semibold">Continue</span>.
        </div>
      )}

      {showSubmit && isSameAsCurrent ? (
        <div className="text-xs opacity-70">Select a different plan to continue.</div>
      ) : null}
    </div>
  );
}
