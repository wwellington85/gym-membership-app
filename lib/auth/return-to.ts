const STAFF_PREFIXES = [
  "/dashboard",
  "/account",
  "/applications",
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
  if (rt.startsWith("//") || /[\u0000-\u001f\\]/.test(rt)) return "";
  const pathname = rt.split(/[?#]/, 1)[0];

  const isStaff = STAFF_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  const isMember = pathname === "/member" || pathname.startsWith("/member/");
  const isRecovery = pathname === "/auth/update-password";

  return isStaff || isMember || isRecovery ? rt : "";
}

export function withParam(path: string, key: string, value: string) {
  const [p, qs = ""] = path.split("?");
  const params = new URLSearchParams(qs);
  params.set(key, value);
  const next = params.toString();
  return next ? `${p}?${next}` : p;
}
