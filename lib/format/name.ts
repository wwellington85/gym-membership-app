export function titleCaseName(v?: string | null) {
  let s = String(v || "").trim();
  if (!s) return "";
  s = s.replace(/[._-]+/g, " ");
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function firstName(v?: string | null) {
  const full = titleCaseName(v);
  if (!full) return "";
  return full.split(/\s+/)[0] || full;
}
