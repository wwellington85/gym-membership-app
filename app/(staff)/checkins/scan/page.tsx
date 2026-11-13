import { effectiveBenefits } from "@/lib/access/benefits";
import Link from "next/link";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
import { loadAccess, loadCatalogue } from "@/lib/access/server";
import {
  memberIdFromNumber,
  normalizeMemberNumber,
  formatMemberNumber,
} from "@/lib/access/rules";
import { verifyQrToken } from "@/lib/qr/token";
import { QrScanner } from "@/components/checkins/qr-scanner";

export const dynamic = "force-dynamic";
export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{
    member?: string;
    code?: string;
    err?: string;
    ok?: string;
  }>;
}) {
  const { admin, staff } = await requireStaff();
  const sp = await searchParams;
  async function lookup(data: FormData) {
    "use server";
    const { admin: lookupAdmin } = await requireStaff();
    const code = String(data.get("code") || "").trim();
    let id = memberIdFromNumber(code.replace(/^member:/, ""));
    const number = normalizeMemberNumber(code);
    if (!id && number) {
      const lookupQuery = lookupAdmin.from("members").select("id");
      const { data: match, error } = await (
        number.length === 12
          ? lookupQuery.or(
              `member_number.eq.${number},member_number.eq.${number}0041`,
            )
          : lookupQuery.eq("member_number", number)
      ).maybeSingle();
      if (error)
        redirect(
          "/checkins/scan?err=Member%20lookup%20is%20temporarily%20unavailable.%20Please%20try%20again.",
        );
      id = match?.id || null;
    }
    if (!id) {
      const token = code.replace(/^qr:/, "");
      const secret = process.env.QR_TOKEN_SECRET;
      const result = secret ? verifyQrToken(token, secret) : null;
      if (result?.ok) id = result.claims.mid;
    }
    if (!id)
      redirect(
        "/checkins/scan?err=This%20code%20is%20invalid%20or%20expired.%20Ask%20the%20guest%20to%20refresh%20their%20card%20or%20use%20member%20lookup.",
      );
    redirect(`/checkins/scan?member=${id}`);
  }
  async function recordVisit(data: FormData) {
    "use server";
    const { admin, user } = await requireStaff();
    const id = String(data.get("member_id") || "");
    const { data: outcome, error } = await admin.rpc("record_gym_visit", {
      p_member_id: id,
      p_staff_id: user.id,
    });
    redirect(
      `/checkins/scan?member=${encodeURIComponent(id)}&${error ? "err=Gym%20visit%20could%20not%20be%20recorded.%20Verify%20access%20or%20contact%20the%20front%20desk." : `ok=${outcome ? "recorded" : "already"}`}`,
    );
  }
  async function recordBenefit(data: FormData) {
    "use server";
    const { admin, user } = await requireStaff(["admin", "front_desk"]);
    const id = String(data.get("member_id") || "");
    const { error } = await admin.rpc("record_benefit_use", {
      p_member_id: id,
      p_outlet: String(data.get("outlet") || ""),
      p_reference: String(data.get("bill_reference") || "").slice(0, 100),
      p_staff_id: user.id,
      p_key: String(data.get("submission_key") || ""),
    });
    redirect(
      `/checkins/scan?member=${encodeURIComponent(id)}&${error ? "err=Benefit%20use%20was%20not%20recorded.%20Check%20eligibility%20and%20whether%20this%20bill%20was%20already%20recorded." : "ok=benefit"}`,
    );
  }
  const id = sp.member && memberIdFromNumber(sp.member);
  const { data: member } = id
    ? await admin
        .from("members")
        .select("id, member_number, full_name, is_active")
        .eq("id", id)
        .maybeSingle()
    : { data: null };
  const access = member ? await loadAccess(member.id, member.is_active) : null;
  const catalogue = member ? await loadCatalogue() : [];
  const free = catalogue.find((p) => p.code === "rewards_free");
  const benefits = effectiveBenefits(
    free,
    access?.passes ?? [],
    member?.is_active ?? false,
  );
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Verify member</h1>
      {sp.err && (
        <p role="alert" className="oura-alert-danger">
          {sp.err}
        </p>
      )}
      {sp.ok && (
        <p role="status" className="oura-alert-success">
          {sp.ok === "benefit"
            ? "Benefit use recorded. No gym visit was created."
            : sp.ok === "already"
              ? "Gym visit already recorded today."
              : "Gym visit recorded."}
        </p>
      )}
      <QrScanner lookup={lookup} />
      <form action={lookup} className="space-y-2">
        <label htmlFor="member-code" className="text-sm">
          Membership number or QR value
        </label>
        <input
          id="member-code"
          name="code"
          required
          className="oura-input w-full p-3"
          autoComplete="off"
        />
        <button className="rounded border px-4 py-3">Look up card</button>
      </form>
      <Link href="/members" className="inline-block py-3 underline">
        Search by name or phone
      </Link>
      {id && !member && (
        <p role="status">
          No member found. Search by name or ask the front desk.
        </p>
      )}
      {member && access && (
        <section className="oura-card space-y-4 p-4">
          <h2 className="text-xl font-semibold">{member.full_name}</h2>
          <p className="break-all font-mono text-xs">
            {formatMemberNumber(member.member_number) ||
              "Membership number unavailable"}
          </p>
          <p>
            {member.is_active
              ? "Rewards membership active"
              : "Member inactive — refer to front desk"}
          </p>
          <div className="rounded border p-3">
            <h3 className="font-semibold">Facility permission now</h3>
            <p className="mt-2">
              Gym: <strong>{access.gym ? "Allowed" : "No paid access"}</strong>
            </p>
            <p className="mt-2">
              Pool & resort facilities:{" "}
              <strong>{access.resort ? "Allowed" : "No paid access"}</strong>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Room-booking inclusions must be verified separately at the front
              desk.
            </p>
          </div>
          {member.is_active && (
            <div className="space-y-2">
              <h3 className="font-semibold">Discounts valid now</h3>
              {benefits.map((benefit) => (
                <p className="flex justify-between text-sm" key={benefit.key}>
                  <span>{benefit.label}</span>
                  <strong>{benefit.percent}%</strong>
                </p>
              ))}
              <p className="text-sm text-muted-foreground">
                Verifying or applying a discount does not record a gym visit.
              </p>
            </div>
          )}
          {member.is_active && staff.role !== "security" && (
            <details className="rounded border p-3">
              <summary className="cursor-pointer py-2 font-semibold">
                Record benefit use
              </summary>
              <form action={recordBenefit} className="space-y-3 pt-3">
                <input type="hidden" name="member_id" value={member.id} />
                <input
                  type="hidden"
                  name="submission_key"
                  value={randomUUID()}
                />
                <div>
                  <label htmlFor="benefit-outlet">Outlet</label>
                  <select
                    id="benefit-outlet"
                    name="outlet"
                    className="oura-input mt-2 w-full p-3"
                  >
                    <option value="restaurant">Restaurant & bar</option>
                    <option value="spa">Spa</option>
                    <option value="giftshop">Gift shop</option>
                    <option value="watersports">Watersports</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="benefit-bill">Bill / receipt reference</label>
                  <input
                    id="benefit-bill"
                    name="bill_reference"
                    required
                    maxLength={100}
                    className="oura-input mt-2 w-full p-3"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Record after applying the verified discount through the
                  outlet’s billing process. This logs use; it does not change a
                  bill or redeem points. A bill can be recorded once per outlet
                  per Jamaica day.
                </p>
                <button className="rounded border p-3">
                  Record verified benefit use
                </button>
              </form>
            </details>
          )}
          {access.gym && (
            <form action={recordVisit}>
              <input type="hidden" name="member_id" value={member.id} />
              <button className="w-full rounded border bg-secondary p-3">
                Record gym visit
              </button>
            </form>
          )}
          <Link
            href={`/members/${member.id}`}
            className="inline-block py-2 underline"
          >
            Open member record
          </Link>
        </section>
      )}
    </div>
  );
}
