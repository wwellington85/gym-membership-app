import { createAdminClient } from "@/lib/supabase/admin";
import {
  type ExperienceProduct,
  type CabanaDay,
  type OccupiedSlot,
} from "./catalogue";

export async function loadBookingCatalogue() {
  const { data, error } = await createAdminClient()
    .from("experience_products")
    .select("code,name,price,currency,tax_rate,service_rate,inclusions")
    .eq("active", true)
    .order("price");
  if (error) throw new Error("Experiences are temporarily unavailable");
  return (data || []) as ExperienceProduct[];
}
export async function loadCabanaAvailability(date: string) {
  const admin = createAdminClient();
  const [days, slots] = await Promise.all([
    admin
      .from("cabana_days")
      .select("cabana,first_start")
      .eq("booking_date", date),
    admin
      .from("experience_bookings")
      .select("cabana,start_minute")
      .eq("booking_date", date)
      .not("cabana", "is", null)
      .in("status", ["requested", "confirmed", "completed"]),
  ]);
  if (days.error || slots.error)
    throw new Error("Availability could not be loaded. Please try again.");
  return {
    days: (days.data || []) as CabanaDay[],
    occupied: (slots.data || []) as OccupiedSlot[],
  };
}
export function bookingPayload(form: FormData) {
  const menu = [0, 1].map((i) => ({
    appetizer: String(form.get(`appetizer_${i}`) || ""),
    salad: String(form.get(`salad_${i}`) || ""),
    main: String(form.get(`main_${i}`) || ""),
    sides: form.getAll(`sides_${i}`).map(String),
    dessert: String(form.get(`dessert_${i}`) || ""),
  }));
  return {
    product: String(form.get("product") || ""),
    date: String(form.get("date") || ""),
    start: Number(form.get("start")),
    cabana: Number(form.get("cabana")) || null,
    guest_name: String(form.get("guest_name") || "").trim(),
    email: String(form.get("email") || "").trim(),
    phone: String(form.get("phone") || "").trim(),
    room: String(form.get("room") || "").trim(),
    occasion: String(form.get("occasion") || ""),
    dietary_notes: String(form.get("dietary_notes") || "").trim(),
    notes: String(form.get("notes") || "").trim(),
    menu,
  };
}
const safeMessages = [
  "Booking changed; refresh before continuing",
  "Active member required",
  "Provide a phone, email or room number",
  "Package unavailable",
  "Choose a future date and time within the next year",
  "Dinner requires at least 24 hours notice",
  "Select a complete menu for both guests",
  "Choose an available four-hour slot",
  "Schedule changed; choose an available slot",
  "Slot just booked; choose another",
  "Record payment before confirming",
  "Payment must match the booking total",
  "Provide payment method and receipt reference",
  "Booking is no longer open",
  "Check dinner setup and kitchen availability first",
  "Contact the front desk to change a confirmed or paid booking",
  "Please contact the front desk before making another request",
  "Give a reason",
  "Provide refund receipt reference",
  "Cancel booking before recording a refund",
  "Booking time has passed",
  "Complete a confirmed booking after it starts",
  "Submission changed; refresh and try again",
];
export function bookingError(message: string) {
  return safeMessages.includes(message)
    ? message
    : "Booking could not be saved. Refresh availability and try again, or contact the front desk.";
}
