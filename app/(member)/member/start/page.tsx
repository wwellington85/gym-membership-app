import { redirect } from "next/navigation";
import { requireMember, loadAccess } from "@/lib/access/server";
import {
  memberStartPath,
  startScreenPreference,
} from "@/lib/member/navigation";

export const dynamic = "force-dynamic";
export default async function StartPage() {
  const { user, member } = await requireMember();
  const preference = startScreenPreference(
    user.user_metadata?.member_start_screen,
  );
  if (preference !== "auto") redirect(memberStartPath(preference, []));
  let destination = "/member";
  try {
    const access = await loadAccess(member.id, member.is_active);
    destination = memberStartPath(preference, access.passes, member.is_active);
  } catch {
    // An access lookup outage must not prevent the rest of the app opening.
  }
  redirect(destination);
}
