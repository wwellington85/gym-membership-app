"use server";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/access/server";

export async function saveStartingScreen(data: FormData) {
  const { supabase } = await requireMember();
  const preference = String(data.get("starting_screen") || "");
  if (!["auto", "home", "gym"].includes(preference))
    redirect("/member/settings?err=Choose%20a%20valid%20starting%20screen.");
  const { error } = await supabase.auth.updateUser({
    data: { member_start_screen: preference },
  });
  redirect(
    error
      ? "/member/settings?err=Could%20not%20save%20your%20starting%20screen.%20Please%20try%20again."
      : "/member/settings?preference_saved=1#starting-screen",
  );
}
