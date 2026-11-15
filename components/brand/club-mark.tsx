import { useId } from "react";

// The same T/C geometry and cutouts as public/brand/club-icon.svg.
// Transparent, single-ink treatment for use on the membership card finishes.
export function ClubMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const tee = "M190 245h510v112H500v422H388V357H190z";
  const see = "M793 380a200 200 0 1 0 0 282";
  return (
    <svg
      className={className}
      viewBox="0 0 1024 1024"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <mask
          id={`${id}-t`}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="1024"
          height="1024"
        >
          <rect width="1024" height="1024" fill="white" />
          <path
            d={see}
            stroke="black"
            strokeWidth="100"
            strokeLinecap="round"
          />
        </mask>
        <mask
          id={`${id}-c`}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="1024"
          height="1024"
        >
          <rect width="1024" height="1024" fill="white" />
          <path d={tee} fill="black" />
        </mask>
      </defs>
      <path d={tee} fill="currentColor" mask={`url(#${id}-t)`} />
      <path
        d={see}
        stroke="currentColor"
        strokeWidth="100"
        strokeLinecap="round"
        mask={`url(#${id}-c)`}
      />
    </svg>
  );
}
