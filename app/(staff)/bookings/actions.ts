"use server";
import { requireStaff } from "@/lib/auth/staff";
import { bookingError, bookingPayload } from "@/lib/bookings/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
export async function staffCreateBooking(form: FormData) {
  const { user, admin } = await requireStaff([
    "admin",
    "supervisor",
    "front_desk",
  ]);
  const payload = bookingPayload(form);
  const number = String(form.get("member_number") || "").replace(/\s/g, "");
  let memberId: null | string = null;
  if (number) {
    const { data: member, error } = await admin
      .from("members")
      .select("id")
      .eq("member_number", number)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !member)
      return { error: "Active member not found. Check the membership number." };
    memberId = member.id;
  }
  const { data, error } = await admin.rpc("create_experience_booking", {
    p_actor: user.id,
    p_member: memberId,
    p_source: "staff",
    p_key: String(form.get("submission_key") || ""),
    p_payload: payload,
  });
  if (error) return { error: bookingError(error.message) };
  revalidatePath("/bookings");
  revalidatePath("/member/bookings");
  redirect(
    `/bookings?date=${encodeURIComponent(payload.date)}&saved=1#booking-${data}`,
  );
}
export async function staffManageBooking(form: FormData) {
  const { user, admin } = await requireStaff([
    "admin",
    "supervisor",
    "front_desk",
  ]);
  const menu = bookingPayload(form).menu;
  const { error } = await admin.rpc("manage_experience_booking", {
    p_actor: user.id,
    p_booking: String(form.get("booking_id") || ""),
    p_action: String(form.get("action") || ""),
    p_detail: {
      expected_revision: Number(form.get("expected_revision")),
      amount: form.get("amount"),
      currency: form.get("currency"),
      method: form.get("method"),
      reference: form.get("reference"),
      reason: form.get("reason"),
      availability_checked: form.get("availability_checked") === "on",
      date: form.get("new_date"),
      start: form.get("start"),
      cabana: form.get("cabana"),
      menu,
      dietary_notes: String(form.get("dietary_notes") || "").trim(),
    },
  });
  revalidatePath("/bookings");
  revalidatePath("/member/bookings");
  revalidatePath("/dashboard");
  const date = String(form.get("date") || "");
  redirect(
    `/bookings?date=${encodeURIComponent(date)}&${error ? `err=${encodeURIComponent(bookingError(error.message))}` : "updated=1"}#booking-${String(form.get("booking_id") || "")}`,
  );
}
