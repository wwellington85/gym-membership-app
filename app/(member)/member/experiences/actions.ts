"use server";
import { requireMember } from "@/lib/access/server";
import { bookingError, bookingPayload } from "@/lib/bookings/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function requestExperience(form: FormData) {
  const { member, user, admin } = await requireMember();
  const payload = bookingPayload(form);
  const { error } = await admin.rpc("request_member_experience", {
    p_actor: user.id,
    p_member: member.id,
    p_key: String(form.get("submission_key") || ""),
    p_payload: payload,
  });
  if (error) return { error: bookingError(error.message) };
  revalidatePath("/member/bookings");
  revalidatePath("/bookings");
  redirect("/member/bookings?saved=1");
}
export async function cancelExperience(form: FormData) {
  const { user, admin } = await requireMember();
  const { error } = await admin.rpc("manage_experience_booking", {
    p_actor: user.id,
    p_booking: String(form.get("booking_id") || ""),
    p_action: "cancel",
    p_detail: {},
  });
  revalidatePath("/member/bookings");
  revalidatePath("/bookings");
  redirect(
    `/member/bookings?${error ? `err=${encodeURIComponent(bookingError(error.message))}` : "cancelled=1"}`,
  );
}
