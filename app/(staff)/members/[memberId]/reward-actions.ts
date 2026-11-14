"use server";
import { requireStaff } from "@/lib/auth/staff";
import { redirect } from "next/navigation";
const uuid = /^[0-9a-f-]{36}$/i;
export async function issueGiftAction(form: FormData) {
  const { admin, user } = await requireStaff(["admin"]);
  const id = String(form.get("member_id") || "");
  if (!uuid.test(id)) redirect("/members");
  const { error } = await admin.rpc("issue_reward_gift", {
    p_member_id: id,
    p_title: String(form.get("title") || "").trim(),
    p_terms: String(form.get("terms") || "").trim(),
    p_reason: String(form.get("reason") || "").trim(),
    p_category: String(form.get("category") || ""),
    p_valid_until: String(form.get("valid_until") || ""),
    p_staff_id: user.id,
    p_key: String(form.get("submission_key") || ""),
  });
  redirect(
    `/members/${id}?${error ? "err=Reward%20was%20not%20issued.%20Check%20details%20and%20whether%20a%20quarterly%20meal%20already%20exists." : "gift_saved=1"}`,
  );
}
export async function revokeGiftAction(form: FormData) {
  const { admin, user } = await requireStaff(["admin"]);
  const id = String(form.get("member_id") || "");
  if (!uuid.test(id)) redirect("/members");
  const { error } = await admin.rpc("revoke_reward_gift", {
    p_gift_id: String(form.get("gift_id") || ""),
    p_member_id: id,
    p_staff_id: user.id,
    p_reason: String(form.get("reason") || "").trim(),
  });
  redirect(
    `/members/${id}?${error ? "err=Only%20an%20unused%20reward%20can%20be%20revoked.%20Give%20a%20reason." : "gift_saved=1"}`,
  );
}
