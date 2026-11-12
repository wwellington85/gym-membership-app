import { headers } from "next/headers";
import { safeReturnTo } from "./return-to";

export async function memberLoginHref() {
  const destination = safeReturnTo((await headers()).get("x-member-return-to"));
  return destination &&
    (destination === "/member" || destination.startsWith("/member/"))
    ? `/auth/login?returnTo=${encodeURIComponent(destination)}`
    : "/auth/login";
}
