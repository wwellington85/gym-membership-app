import { requireStaff } from "@/lib/auth/staff";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
export type RewardPermissions = {
  can_issue: boolean;
  can_redeem: boolean;
  can_revoke: boolean;
};
export async function rewardPermissions(
  admin: SupabaseClient,
  role: string,
): Promise<RewardPermissions> {
  if (role === "admin")
    return { can_issue: true, can_redeem: true, can_revoke: true };
  if (!["supervisor", "front_desk"].includes(role))
    return { can_issue: false, can_redeem: false, can_revoke: false };
  const { data, error } = await admin
    .from("reward_role_permissions")
    .select("can_issue, can_redeem, can_revoke")
    .eq("role", role)
    .maybeSingle();
  if (error)
    throw new Error(
      "Reward permissions could not be verified. Please try again.",
    );
  return {
    can_issue: data?.can_issue === true,
    can_redeem: data?.can_redeem === true,
    can_revoke: data?.can_revoke === true,
  };
}
export async function requireRewardPermission(
  permission: keyof RewardPermissions,
) {
  const context = await requireStaff(["admin", "supervisor", "front_desk"]);
  const permissions = await rewardPermissions(
    context.admin,
    context.staff.role,
  );
  if (!permissions[permission])
    redirect("/dashboard?err=Reward%20permission%20is%20required.");
  return context;
}
