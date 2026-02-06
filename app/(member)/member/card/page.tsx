import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MemberCardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: member } = await supabase
    .from("members")
    .select("id, full_name, phone, email")
    .eq("user_id", user.id)
    .maybeSingle();

  // Always show the page; if not linked yet, show a friendly empty state.
  if (!member) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Membership Card</h1>
            <p className="text-sm opacity-70">Travellers Club</p>
          </div>
          <Link href="/member" prefetch={false} className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
            Back
          </Link>
        </div>

        <div className="rounded border p-3 text-sm">
          We couldn’t find a membership profile linked to this login yet.
          <div className="mt-2 flex gap-2">
            <Link className="rounded border px-3 py-2 text-sm hover:bg-gray-50" href="/join">
              Join Travellers Club
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // QR payload: member id (simple and reliable for scanning)
  const payload = member.id;

  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 8,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Membership Card</h1>
          <p className="text-sm opacity-70">Show this at the gate / front desk</p>
        </div>
        <Link href="/member" prefetch={false} className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
          Back
        </Link>
      </div>

      <div className="rounded border p-4">
        <div className="text-sm opacity-70">Name</div>
        <div className="text-lg font-semibold">{member.full_name}</div>

        <div className="mt-3 text-sm opacity-70">Member ID</div>
        <div className="font-mono text-sm">{member.id}</div>

        <div className="mt-4 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt="Member QR Code" className="h-56 w-56 rounded border" />
        </div>

        <div className="mt-3 text-center text-xs opacity-70">
          Staff: scan this QR to check you in.
        </div>
      </div>
    </div>
  );
}
