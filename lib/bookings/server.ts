import { createAdminClient } from "@/lib/supabase/admin";
import {
  type ExperienceProduct,
  type CabanaDay,
  type OccupiedSlot,
  requestableTimes,
} from "./catalogue";
import { addDaysYmd } from "@/lib/membership/status";

export async function findNextExperienceDate(
  dinner: boolean,
  from: string,
  max: string,
  now = new Date(),
) {
  if (dinner) {
    for (let date = from; date <= max; date = addDaysYmd(date, 1)) {
      if (requestableTimes(date, true, [], [], now.getTime()).length)
        return { date, days: [], occupied: [] };
    }
    return null;
  }
  const admin = createAdminClient();
  // A 31-day window holds at most 93 day anchors and 186 occupied slots.
  // Keeping batches below PostgREST's row cap avoids treating truncated results
  // as available inventory and avoids a request for every sold-out day.
  for (let start = from; start <= max; start = addDaysYmd(start, 31)) {
    const end = addDaysYmd(start, 30) < max ? addDaysYmd(start, 30) : max;
    const [dayRows, slotRows] = await Promise.all([
      admin
        .from("cabana_days")
        .select("booking_date,cabana,first_start", { count: "exact" })
        .gte("booking_date", start)
        .lte("booking_date", end)
        .order("booking_date")
        .limit(1000),
      admin
        .from("experience_bookings")
        .select("booking_date,cabana,start_minute", { count: "exact" })
        .gte("booking_date", start)
        .lte("booking_date", end)
        .not("cabana", "is", null)
        .in("status", ["requested", "confirmed", "completed"])
        .order("booking_date")
        .limit(1000),
    ]);
    if (
      dayRows.error ||
      slotRows.error ||
      dayRows.count === null ||
      slotRows.count === null ||
      dayRows.data?.length !== dayRows.count ||
      slotRows.data?.length !== slotRows.count
    )
      throw new Error("Availability could not be loaded. Please try again.");
    for (let date = start; date <= end; date = addDaysYmd(date, 1)) {
      const days = (dayRows.data || []).filter(
        (row) => row.booking_date === date,
      ) as CabanaDay[];
      const occupied = (slotRows.data || []).filter(
        (row) => row.booking_date === date,
      ) as OccupiedSlot[];
      if (requestableTimes(date, false, days, occupied, now.getTime()).length)
        return { date, days, occupied };
    }
  }
  return null;
}

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
