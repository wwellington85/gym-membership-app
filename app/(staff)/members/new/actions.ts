"use server";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
export async function createMember(data: FormData) {
  const { admin } = await requireStaff(["admin", "front_desk"]);
  const name = String(data.get("full_name") || "").trim();
  const phone = String(data.get("phone") || "").trim();
  const email = String(data.get("email") || "")
    .trim()
    .toLowerCase();
  const key = String(data.get("enrolment_key") || "");
  if (
    !name ||
    name.length > 120 ||
    phone.length > 40 ||
    (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
    !/^[0-9a-f-]{36}$/i.test(key)
  )
    redirect("/members/new?err=Please%20check%20the%20member%20details.");
  if (email) {
    const { data: existing, error } = await admin
      .from("members")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (error)
      redirect("/members/new?err=Could%20not%20check%20existing%20records.");
    if (existing)
      redirect(
        `/members/${existing.id}?err=A%20member%20already%20uses%20this%20email.%20Verify%20their%20identity%20before%20making%20changes.`,
      );
  }
  const { data: id, error } = await admin.rpc("enrol_club_member", {
    p_name: name,
    p_phone: phone,
    p_email: email || null,
    p_key: key,
  });
  if (error || !id)
    redirect(
      "/members/new?err=Member%20could%20not%20be%20created.%20Search%20for%20an%20existing%20record%20before%20retrying.",
    );
  redirect(`/members/${id}?saved=1`);
}
