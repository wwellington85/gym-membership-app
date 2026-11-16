import { addDaysYmd, jamaicaTodayYmd } from "@/lib/membership/status";
import { requestableTimes } from "./catalogue";

export function validBookingDate(
  value: unknown,
  min: string,
  max: string,
): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < min ||
    value > max
  )
    return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
// This is the earliest day permitted by hours/notice, independently of capacity.
export function earliestRequestDate(dinner: boolean, now = new Date()) {
  const start = jamaicaTodayYmd(
    new Date(now.getTime() + (dinner ? 86_400_000 : 0)),
  );
  for (let offset = 0; offset < 3; offset++) {
    const date = addDaysYmd(start, offset);
    if (requestableTimes(date, dinner, [], [], now.getTime()).length)
      return date;
  }
  return addDaysYmd(start, 3);
}
