import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";

function fmtPoints(n: number | null | undefined) {
  const v = typeof n === "number" ? n : 0;
  return v.toLocaleString();
}

export default async function CardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/auth/login?returnTo=/card");

  // Find the member profile linked to this auth user
  const { data: member, error: memberErr } = await supabase
    .from("members")
    .select("id, full_name")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (memberErr) {
    return (
      <div className="rounded border p-4 text-sm">
        Could not load your profile.
        <div className="mt-1 text-xs opacity-70">{memberErr.message}</div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="rounded border p-4">
        <h1 className="text-lg font-semibold">Travellers Club</h1>
        <p className="mt-2 text-sm opacity-80">
          Your account isn’t linked to a membership profile yet.
        </p>
        <p className="mt-2 text-sm opacity-80">
          Please contact the front desk to connect your account.
        </p>
      </div>
    );
  }

  // Check-ins count (all time)
  const { count: checkinsCount } = await supabase
    .from("checkins")
    .select("id", { count: "exact", head: true })
    .eq("member_id", member.id);

  // Points (your schema already uses member_loyalty_points in staff)
  const { data: pointsRow } = await supabase
    .from("member_loyalty_points")
    .select("points")
    .eq("member_id", member.id)
    .maybeSingle();

  const qrPayload = `member:${member.id}`;
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 220 });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">My Card</h1>
        <p className="text-sm opacity-70">Show this QR code at the gate.</p>
      </div>

      <div className="rounded-xl border p-4">
        <div className="text-sm opacity-70">Name</div>
        <div className="text-lg font-semibold">{member.full_name}</div>

        <div className="mt-3 text-sm opacity-70">Member ID</div>
        <div className="font-mono text-xs break-all">{member.id}</div>

        <div className="mt-4 flex items-center justify-center">
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="Member QR code" className="h-[220px] w-[220px]" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs opacity-70">Check-ins</div>
            <div className="text-lg font-semibold">{checkinsCount ?? 0}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs opacity-70">Points</div>
            <div className="text-lg font-semibold">{fmtPoints(pointsRow?.points)}</div>
          </div>
        </div>
      </div>

      <div className="rounded border p-3 text-xs opacity-70">
        If your QR code doesn’t scan, ask staff to search your Member ID.
      </div>
    </div>
  );
}
