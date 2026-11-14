"use server";
import { requireStaff } from "@/lib/auth/staff";
import { redirect } from "next/navigation";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  );
}
export async function extendAccessAction(formData: FormData) {
  const { admin, user } = await requireStaff(["admin"]);
  const memberId = String(formData.get("member_id") || "");
  if (!uuid.test(memberId)) redirect("/members");
  const fail = (message: string): never =>
    redirect(`/members/${memberId}?err=${encodeURIComponent(message)}`);
  const passId = String(formData.get("pass_id") || "");
  const key = String(formData.get("submission_key") || "");
  const expected = String(formData.get("expected_end") || "");
  const newEnd = String(formData.get("new_end") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (
    !uuid.test(passId) ||
    !uuid.test(key) ||
    !validDate(expected) ||
    !validDate(newEnd) ||
    newEnd <= expected ||
    reason.length < 3 ||
    reason.length > 500
  )
    fail(
      "Choose a later expiry and give a reason between 3 and 500 characters.",
    );
  const { error } = await admin.rpc("extend_access_pass", {
    p_pass_id: passId,
    p_member_id: memberId,
    p_expected_end: expected,
    p_new_end: newEnd,
    p_reason: reason,
    p_staff_id: user.id,
    p_key: key,
  });
  if (error)
    fail(
      "Access was not extended. Reload the record and check the member, pass and expiry before retrying.",
    );
  redirect(`/members/${memberId}?extended=1`);
}
