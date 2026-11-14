export const dinnerMenu = {
  appetizer: ["Fish Cake", "Chicken Kebab", "Veggie Wrap"],
  salad: ["Caesar Salad", "Tossed Salad", "Cob Salad"],
  main: [
    "Cajun Shrimp",
    "Parmesan Chicken",
    "Traditional Jerk Fish in foil",
    "Garlic Lobster",
    "Strip Loin Steak",
    "Travellers Veggie Bowl",
  ],
  sides: ["Grill Pumpkin & Potato", "Herb Mash Potato", "Vegetable Rice"],
  dessert: ["Travellers Rocky Road", "Tropical Fruit Salad"],
} as const;
export type DinnerSelection = {
  appetizer: string;
  salad: string;
  main: string;
  sides: string[];
  dessert: string;
};
export type ExperienceProduct = {
  code: string;
  name: string;
  price: number;
  currency: string;
  tax_rate: number;
  service_rate: number;
  inclusions: string[];
};
export type CabanaDay = { cabana: number; first_start: number };
export type OccupiedSlot = { cabana: number; start_minute: number };
export type Booking = {
  id: string;
  member_id: string | null;
  product_code: string;
  booking_date: string;
  start_minute: number;
  end_minute: number | null;
  cabana: number | null;
  guest_name: string;
  email: string;
  phone: string;
  room: string;
  occasion: string;
  menu: DinnerSelection[];
  dietary_notes: string;
  notes: string;
  product_snapshot: ExperienceProduct;
  total: number;
  currency: string;
  status: string;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  refunded_at: string | null;
  refund_reference: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  revision: number;
};
export const bookingColumns =
  "id,member_id,product_code,booking_date,start_minute,end_minute,cabana,guest_name,email,phone,room,occasion,menu,dietary_notes,notes,product_snapshot,total,currency,status,paid_at,payment_method,payment_reference,refunded_at,refund_reference,cancellation_reason,created_at,updated_at,revision";
export function timeLabel(minute: number) {
  const hour = Math.floor(minute / 60);
  return `${hour % 12 || 12}:${String(minute % 60).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
}
export function productTotal(p: ExperienceProduct) {
  return (
    Math.round(
      Number(p.price) * (1 + Number(p.tax_rate) + Number(p.service_rate)) * 100,
    ) / 100
  );
}
export function money(amount: number | string, currency = "USD") {
  return (
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
      Number(amount),
    ) + ` ${currency}`
  );
}
export function cabanaStarts(
  cabana: number,
  days: CabanaDay[],
  occupied: OccupiedSlot[],
) {
  const day = days.find((d) => d.cabana === cabana);
  const starts = day
    ? [day.first_start, day.first_start + 240]
    : Array.from({ length: 15 }, (_, i) => 420 + i * 30).filter(
        (n) => n <= 600 || n >= 660,
      );
  return starts.filter(
    (start) =>
      !occupied.some((s) => s.cabana === cabana && s.start_minute === start),
  );
}
export function availableCabanaStarts(
  days: CabanaDay[],
  occupied: OccupiedSlot[],
) {
  return [
    ...new Set(
      [1, 2, 3].flatMap((cabana) => cabanaStarts(cabana, days, occupied)),
    ),
  ].sort((a, b) => a - b);
}
export function futureSlot(
  date: string,
  minute: number,
  noticeHours = 0,
  now = Date.now(),
) {
  return (
    Date.parse(
      `${date}T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}:00-05:00`,
    ) >
    now + noticeHours * 3600000
  );
}
export function bookingStatus(status: string) {
  return (
    (
      {
        requested: "Awaiting confirmation",
        confirmed: "Confirmed",
        completed: "Completed",
        cancelled: "Cancelled",
        declined: "Declined",
      } as Record<string, string>
    )[status] || status
  );
}
