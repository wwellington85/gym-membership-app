import { accessScope, passIsActive, type AccessPass } from "@/lib/access/rules";
import { safeReturnTo } from "@/lib/auth/return-to";

export type StartScreen = "auto" | "home" | "gym";
export function startScreenPreference(value: unknown): StartScreen {
  return value === "home" || value === "gym" ? value : "auto";
}

// A display preference only; it must never grant access or change membership.
export function memberStartPath(
  preference: unknown,
  passes: AccessPass[],
  active = true,
  now = new Date(),
) {
  const choice = startScreenPreference(preference);
  if (choice !== "auto") return choice === "gym" ? "/member/gym" : "/member";
  return active &&
    passes.some(
      (pass) =>
        accessScope(pass.plan_snapshot) === "gym" && passIsActive(pass, now),
    )
    ? "/member/gym"
    : "/member";
}

export function memberTab(pathname: string) {
  if (
    ["/member/gym", "/member/leaderboard", "/member/check-ins"].some(
      (path) => pathname === path || pathname.startsWith(path + "/"),
    )
  )
    return "/member/gym";
  if (pathname === "/member/activity" || pathname === "/member/points")
    return "/member/benefits";
  if (pathname.startsWith("/member/card")) return "/member/card";
  if (pathname.startsWith("/member/benefits")) return "/member/benefits";
  if (
    pathname.startsWith("/member/settings") ||
    pathname === "/member/help" ||
    pathname.includes("/payment")
  )
    return "/member/settings";
  return "/member";
}

export function memberPageParent(
  pathname: string,
): { href: string; label: string } | null {
  if (
    [
      "/member",
      "/member/gym",
      "/member/card",
      "/member/benefits",
      "/member/settings",
      "/member/start",
    ].includes(pathname)
  )
    return null;
  if (pathname === "/member/leaderboard" || pathname === "/member/check-ins")
    return { href: "/member/gym", label: "Back to Gym" };
  if (pathname === "/member/upgrade" || pathname === "/member/checkout")
    return { href: "/member/access", label: "Back to access" };
  if (pathname === "/member/activity" || pathname === "/member/points")
    return { href: "/member/benefits", label: "Back to Benefits" };
  if (pathname === "/member/help" || pathname.includes("/payment"))
    return { href: "/member/settings", label: "Back to Account" };
  return { href: "/member", label: "Back to Home" };
}

export function backDestination(
  returnTo: string | null,
  fallback: string,
  current: string,
) {
  const destination = safeReturnTo(returnTo);
  // Ignore self references and unsafe destinations. Use a stable parent rather
  // than guessing browser history, which may lead out of an installed app.
  return destination && destination.split(/[?#]/, 1)[0] !== current
    ? destination
    : safeReturnTo(fallback) || "/member";
}
