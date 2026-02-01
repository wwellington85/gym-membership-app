export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FlashBanners } from "@/components/ui/flash-banners";

type Role = "admin" | "front_desk" | "security";
const ROLES: Role[] = ["admin", "front_desk", "security"];

type SortKey = "newest" | "oldest" | "email_asc" | "role_asc" | "status_active_first";

async function getOrigin() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

function sortLabel(sort: SortKey) {
  switch (sort) {
    case "oldest":
      return "Oldest";
    case "email_asc":
      return "Email A–Z";
    case "role_asc":
      return "Role";
    case "status_active_first":
      return "Active first";
    case "newest":
    default:
      return "Newest";
  }
}

function safeReturnTo(raw: string) {
  const rt = (raw || "/settings/staff").trim();
  return rt.startsWith("/settings/staff") ? rt : "/settings/staff";
}

function withParam(url: string, key: string, value: string) {
  const parts = url.split("?");
  const path = parts[0] || "/settings/staff";
  const qs = parts[1] || "";
  const params = new URLSearchParams(qs);
  params.set(key, value);
  const next = params.toString();
  return next ? (path + "?" + next) : path;
}


export default async function StaffManagementPage({
  searchParams,
}: {
  searchParams?: Promise<{
    saved?: string;
    err?: string;
    sent?: string;
    q?: string;
    role?: string;
    active?: string; // all | active | inactive
    sort?: SortKey;
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: staffProfile } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staffProfile) redirect("/auth/login");
  if (staffProfile.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();

  const q = (sp.q ?? "").trim().toLowerCase();
  const roleFilter = (sp.role ?? "all").trim();
  const activeFilter = (sp.active ?? "all").trim();
  const sort: SortKey = (sp.sort ?? "newest") as SortKey;

  function hrefWith(overrides: Partial<{ q: string; role: string; active: string; sort: SortKey }>) {
    const params = new URLSearchParams();

    const nextQ = overrides.q ?? q;
    const nextRole = overrides.role ?? roleFilter;
    const nextActive = overrides.active ?? activeFilter;
    const nextSort = overrides.sort ?? sort;

    if (nextQ) params.set("q", nextQ);
    if (nextRole && nextRole !== "all") params.set("role", nextRole);
    if (nextActive && nextActive !== "all") params.set("active", nextActive);
    if (nextSort && nextSort !== "newest") params.set("sort", nextSort);

    const qs = params.toString();
    return qs ? `/settings/staff?${qs}` : "/settings/staff";
  }

  const returnTo = hrefWith({});

  // Build staff query with filters/sort
  let staffQuery = admin
    .from("staff_profiles")
    .select("user_id, email, role, is_active, created_at");

  if (q) staffQuery = staffQuery.ilike("email", `%${q}%`);
  if (ROLES.includes(roleFilter as Role)) staffQuery = staffQuery.eq("role", roleFilter as Role);

  if (activeFilter === "active") staffQuery = staffQuery.eq("is_active", true);
  else if (activeFilter === "inactive") staffQuery = staffQuery.eq("is_active", false);

  switch (sort) {
    case "oldest":
      staffQuery = staffQuery.order("created_at", { ascending: true });
      break;
    case "email_asc":
      staffQuery = staffQuery.order("email", { ascending: true, nullsFirst: true });
      break;
    case "role_asc":
      staffQuery = staffQuery
        .order("role", { ascending: true })
        .order("email", { ascending: true, nullsFirst: true });
      break;
    case "status_active_first":
      staffQuery = staffQuery
        .order("is_active", { ascending: false })
        .order("role", { ascending: true })
        .order("email", { ascending: true, nullsFirst: true });
      break;
    case "newest":
    default:
      staffQuery = staffQuery.order("created_at", { ascending: false });
      break;
  }

  const { data: staff, error } = await staffQuery;
  async function inviteStaff(formData: FormData) {
    "use server";

    const rawReturnTo = String(formData.get("returnTo") || "/settings/staff");
    const backTo = safeReturnTo(rawReturnTo);

    const email = String(formData.get("email") || "").trim().toLowerCase();
    const role = String(formData.get("role") || "").trim() as Role;

    if (!email) redirect(withParam(backTo, "err", "Missing email"));
    if (!ROLES.includes(role)) redirect(withParam(backTo, "err", "Invalid role"));

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    const { data: me } = await supabase
      .from("staff_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!me || me.role !== "admin") redirect("/dashboard");

    const admin = createAdminClient();

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
    if (error) redirect(withParam(backTo, "err", error.message));

    const invitedUserId = data?.user?.id;
    if (!invitedUserId) redirect(withParam(backTo, "err", "Invite failed (no user id)"));

    const { error: upsertErr } = await admin.from("staff_profiles").upsert(
      { user_id: invitedUserId, email, role, is_active: true },
      { onConflict: "user_id" }
    );

    if (upsertErr) redirect(withParam(backTo, "err", upsertErr.message));

    redirect(withParam(backTo, "saved", "1"));
  }

  async function updateRole(formData: FormData) {
    "use server";

    const rawReturnTo = String(formData.get("returnTo") || "/settings/staff");
    const backTo = safeReturnTo(rawReturnTo);

    const targetUserId = String(formData.get("user_id") || "").trim();
    const role = String(formData.get("role") || "").trim() as Role;

    if (!targetUserId) redirect(withParam(backTo, "err", "Missing user_id"));
    if (!ROLES.includes(role)) redirect(withParam(backTo, "err", "Invalid role"));

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    const { data: me } = await supabase
      .from("staff_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!me || me.role !== "admin") redirect("/dashboard");

    if (targetUserId === user.id && role !== "admin") {
      redirect(withParam(backTo, "err", "You cannot remove your own admin role"));
    }

    const admin = createAdminClient();

    const { error } = await admin
      .from("staff_profiles")
      .update({ role })
      .eq("user_id", targetUserId);

    if (error) redirect(withParam(backTo, "err", error.message));
    redirect(withParam(backTo, "saved", "1"));
  }

  async function toggleActive(formData: FormData) {
    "use server";

    const rawReturnTo = String(formData.get("returnTo") || "/settings/staff");
    const backTo = safeReturnTo(rawReturnTo);

    const targetUserId = String(formData.get("user_id") || "").trim();
    const next = String(formData.get("next") || "").trim() === "true";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    const { data: me } = await supabase
      .from("staff_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!me || me.role !== "admin") redirect("/dashboard");

    if (targetUserId === user.id && next === false) {
      redirect(withParam(backTo, "err", "You cannot deactivate your own account"));
    }

    const admin = createAdminClient();

    const { error } = await admin
      .from("staff_profiles")
      .update({ is_active: next })
      .eq("user_id", targetUserId);

    if (error) redirect(withParam(backTo, "err", error.message));
    redirect(withParam(backTo, "saved", "1"));
  }

  async function sendResetEmail(formData: FormData) {
    "use server";

    const rawReturnTo = String(formData.get("returnTo") || "/settings/staff");
    const backTo = safeReturnTo(rawReturnTo);

    const email = String(formData.get("email") || "").trim().toLowerCase();
    if (!email) redirect(withParam(backTo, "err", "Missing email"));

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    const { data: me } = await supabase
      .from("staff_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!me || me.role !== "admin") redirect("/dashboard");

    const origin = await getOrigin();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/update-password`,
    });

    if (error) redirect(withParam(backTo, "err", error.message));
    redirect(withParam(backTo, "sent", "1"));
  }

  const hasAnyFilters =
    !!q || roleFilter !== "all" || activeFilter !== "all" || sort !== "newest";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Staff Management</h1>
        <p className="text-sm opacity-70">Invite staff, assign roles, and manage access</p>
      </div>

      <FlashBanners />

            <div className="rounded border p-3">
        <div className="font-medium">Invite Staff</div>
        <div className="text-sm opacity-70">Sends an email invite. Staff will set their password from the invite.</div>

        <form action={inviteStaff} className="mt-3 space-y-2">
          <input type="hidden" name="returnTo" value={returnTo} />
          <input
            name="email"
            type="email"
            placeholder="staff@email.com"
            className="w-full rounded border px-3 py-2"
            required
          />
          <select name="role" className="w-full rounded border px-3 py-2" defaultValue="front_desk">
            <option value="admin">Admin</option>
            <option value="front_desk">Front Desk</option>
            <option value="security">Security</option>
          </select>
          <button className="w-full rounded border px-3 py-2 text-sm hover:bg-gray-50">Send Invite</button>
        </form>
      </div>

      <div className="rounded border p-3">
        <div className="font-medium">Search, Filters & Sort</div>

        <form action="/settings/staff" method="get" className="mt-3 grid gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by email…"
            className="w-full rounded border px-3 py-2"
          />

          <div className="grid grid-cols-2 gap-2">
            <select name="role" defaultValue={roleFilter} className="w-full rounded border px-3 py-2 text-sm">
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="front_desk">Front Desk</option>
              <option value="security">Security</option>
            </select>

            <select name="active" defaultValue={activeFilter} className="w-full rounded border px-3 py-2 text-sm">
              <option value="all">All status</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>

          <select name="sort" defaultValue={sort} className="w-full rounded border px-3 py-2 text-sm">
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
            <option value="email_asc">Sort: Email A–Z</option>
            <option value="role_asc">Sort: Role</option>
            <option value="status_active_first">Sort: Active first</option>
          </select>

          <div className="grid grid-cols-2 gap-2">
            <button className="rounded border px-3 py-2 text-sm hover:bg-gray-50">Apply</button>
            <a href="/settings/staff" className="rounded border px-3 py-2 text-center text-sm hover:bg-gray-50">
              Clear
            </a>
          </div>
        </form>
      </div>

      <div className="rounded border p-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">Staff List</div>
          <div className="text-xs opacity-70">{staff?.length ?? 0}</div>
        </div>

        {/* Active filter chips */}
        {hasAnyFilters ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {q ? (
              <a
                href={hrefWith({ q: "" })}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs hover:bg-gray-50"
                title="Remove search"
              >
                Search: <span className="font-medium">{q}</span> <span className="opacity-60">✕</span>
              </a>
            ) : null}

            {roleFilter !== "all" ? (
              <a
                href={hrefWith({ role: "all" })}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs hover:bg-gray-50"
                title="Remove role filter"
              >
                Role: <span className="font-medium">{roleFilter}</span> <span className="opacity-60">✕</span>
              </a>
            ) : null}

            {activeFilter !== "all" ? (
              <a
                href={hrefWith({ active: "all" })}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs hover:bg-gray-50"
                title="Remove status filter"
              >
                Status: <span className="font-medium">{activeFilter}</span> <span className="opacity-60">✕</span>
              </a>
            ) : null}

            {sort !== "newest" ? (
              <a
                href={hrefWith({ sort: "newest" })}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs hover:bg-gray-50"
                title="Reset sort"
              >
                Sort: <span className="font-medium">{sortLabel(sort)}</span>{" "}
                <span className="opacity-60">✕</span>
              </a>
            ) : null}

            <a
              href="/settings/staff"
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs hover:bg-gray-50"
              title="Clear all"
            >
              Clear all <span className="opacity-60">✕</span>
            </a>
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 text-sm">
            Could not load staff.
            <div className="mt-1 text-xs opacity-70">{error.message}</div>
          </div>
        ) : null}

        {!error && (!staff || staff.length === 0) ? (
          <div className="mt-3 text-sm opacity-70">No staff found.</div>
        ) : null}

        <div className="mt-3 space-y-2">
          {(staff ?? []).map((s: any) => {
            const active = s.is_active !== false;
            return (
              <div key={s.user_id} className="rounded border p-3">
                <div>
                  <div className="text-sm font-medium">{s.email ?? "(no email on file)"}</div>
                  <div className="text-xs opacity-70">Role: {s.role}</div>
                  <div className="text-xs opacity-70">Status: {active ? "Active" : "Inactive"}</div>
                </div>

                <div className="mt-3 grid gap-2">
                  <form action={updateRole} className="flex items-center gap-2">
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <input type="hidden" name="user_id" value={s.user_id} />
                    <select name="role" defaultValue={s.role} className="w-full rounded border px-3 py-2 text-sm">
                      <option value="admin">Admin</option>
                      <option value="front_desk">Front Desk</option>
                      <option value="security">Security</option>
                    </select>
                    <button className="rounded border px-3 py-2 text-sm hover:bg-gray-50">Update</button>
                  </form>

                  <div className="flex gap-2">
                    <form action={toggleActive} className="w-1/2">
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <input type="hidden" name="user_id" value={s.user_id} />
                      <input type="hidden" name="next" value={active ? "false" : "true"} />
                      <button className="w-full rounded border px-3 py-2 text-sm hover:bg-gray-50">
                        {active ? "Deactivate" : "Activate"}
                      </button>
                    </form>

                    <form action={sendResetEmail} className="w-1/2">
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <input type="hidden" name="email" value={s.email ?? ""} />
                      <button className="w-full rounded border px-3 py-2 text-sm hover:bg-gray-50">
                        Reset password
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-2">
        <a className="underline underline-offset-2" href="/settings">
          Back to Settings
        </a>
      </div>
    </div>
  );
}
