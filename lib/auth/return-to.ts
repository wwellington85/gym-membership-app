const STAFF_PREFIXES = [
  "/dashboard",
  "/members",
  "/payments",
  "/checkins",
  "/settings",
  "/more",
];

export function safeReturnTo(raw: string | null | undefined) {
  const rt = (raw || "").trim();
  if (!rt) return "";

  // must be a relative path
  if (!rt.startsWith("/")) return "";
  // prevent protocol-relative or weird stuff
  if (rt.startsWith("//")) return "";

  const isStaff =
    STAFF_PREFIXES.some((p) => rt === p || rt.startsWith(p + "/"));
  const isMember = rt === "/member" || rt.startsWith("/member/");

  return (isStaff || isMember) ? rt : "";
}

export function withParam(path: string, key: string, value: string) {
  const [p, qs = ""] = path.split("?");
  const params = new URLSearchParams(qs);
  params.set(key, value);
  const next = params.toString();
  return next ? `${p}?${next}` : p;
}
