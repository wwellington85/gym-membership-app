import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
export default async function RolePermissions({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; err?: string }>;
}) {
  const { admin } = await requireStaff(["admin"]);
  const sp = await searchParams;
  const { data, error } = await admin
    .from("reward_role_permissions")
    .select("role, can_issue, can_redeem, can_revoke")
    .order("role");
  async function save(form: FormData) {
    "use server";
    const { admin, user } = await requireStaff(["admin"]);
    const { error } = await admin.rpc("set_reward_role_permissions", {
      p_role: String(form.get("role")),
      p_issue: form.get("can_issue") === "on",
      p_redeem: form.get("can_redeem") === "on",
      p_revoke: form.get("can_revoke") === "on",
      p_staff_id: user.id,
    });
    redirect(`/settings/permissions?${error ? "err=1" : "saved=1"}`);
  }
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Reward permissions</h1>
      <p className="text-sm text-muted-foreground">
        Control reward actions for supervisors and front desk. Administrators
        retain full access. Staff accounts, role assignment, access extensions
        and programme administration remain admin-only. Security stays a
        gate-verification role.
      </p>
      {sp.saved && (
        <p role="status" className="oura-alert-success">
          Permissions saved. They apply to the next reward action.
        </p>
      )}
      {(error || sp.err) && (
        <p role="alert">
          Permissions could not be loaded or saved. Please retry.
        </p>
      )}
      {data?.map((p) => (
        <form key={p.role} action={save} className="oura-card space-y-3 p-4">
          <h2 className="font-semibold">
            {p.role === "supervisor" ? "Supervisor" : "Front desk"}
          </h2>
          <input type="hidden" name="role" value={p.role} />
          {(
            [
              ["can_issue", "Issue reward gifts"],
              ["can_redeem", "Confirm reward fulfilment"],
              ["can_revoke", "Revoke unused rewards"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3">
              <input
                type="checkbox"
                name={key}
                defaultChecked={p[key]}
                className="h-5 w-5"
              />
              {label}
            </label>
          ))}
          <button className="club-button-secondary">Save permissions</button>
        </form>
      ))}
      <Link href="/settings/staff" className="club-text-link">
        Back to staff management
      </Link>
    </div>
  );
}
