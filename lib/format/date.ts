export function membershipDate(ymd: string) {
  const date = new Date(`${ymd}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? ymd
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "America/Jamaica",
      });
}
