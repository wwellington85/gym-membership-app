import { safeReturnTo } from "@/lib/auth/return-to";

export function googleSignInEnabled() {
  return process.env.GOOGLE_AUTH_ENABLED === "true";
}

// Guest authentication only accepts guest destinations. Staff authorization
// still comes from staff_profiles in the shared post-login handler.
export function googleReturnTo(raw: string | null | undefined) {
  const path = safeReturnTo(raw);
  return path === "/member" || path.startsWith("/member/") ? path : "";
}

export function googlePostLoginPath(raw: string | null | undefined) {
  const path = googleReturnTo(raw);
  return path
    ? `/auth/post-login?returnTo=${encodeURIComponent(path)}`
    : "/auth/post-login";
}
