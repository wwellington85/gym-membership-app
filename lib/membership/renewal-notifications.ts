function todayIsoJamaica() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Jamaica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dateDiffDays(fromIso: string, toIso: string) {
  const from = new Date(`${fromIso}T00:00:00.000Z`);
  const to = new Date(`${toIso}T00:00:00.000Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / 86400000);
}

function isMissingNotificationsTable(error: any) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "");
  return code === "PGRST205" || /membership_renewal_notifications/i.test(message);
}

export async function queueRenewalNotificationsForMembership(args: {
  supabase: any;
  memberId: string;
  membershipId: string;
  paidThroughDate: string | null | undefined;
}) {
  const { supabase, memberId, membershipId, paidThroughDate } = args;
  const paidThrough = String(paidThroughDate ?? "").slice(0, 10);
  if (!paidThrough) return;

  const today = todayIsoJamaica();
  const daysLeft = dateDiffDays(today, paidThrough);
  if (daysLeft === null || daysLeft < 0) return;

  const rules = [
    { days: 14, key: "14d" },
    { days: 3, key: "3d" },
  ] as const;

  const toInsert = rules
    .filter((r) => daysLeft <= r.days)
    .map((r) => ({
      member_id: memberId,
      membership_id: membershipId,
      paid_through_date: paidThrough,
      reminder_key: r.key,
      reminder_days: r.days,
    }));

  if (toInsert.length === 0) return;

  const { error } = await supabase
    .from("membership_renewal_notifications")
    .upsert(toInsert, {
      onConflict: "member_id,membership_id,paid_through_date,reminder_key",
      ignoreDuplicates: true,
    });

  if (error && !isMissingNotificationsTable(error)) {
    console.error("queueRenewalNotificationsForMembership error:", error);
  }
}

export async function getCurrentUnseenRenewalNotifications(args: {
  supabase: any;
  memberId: string;
  paidThroughDate: string | null | undefined;
}) {
  const { supabase, memberId, paidThroughDate } = args;
  const paidThrough = String(paidThroughDate ?? "").slice(0, 10);
  if (!paidThrough) return [] as any[];

  const { data, error } = await supabase
    .from("membership_renewal_notifications")
    .select("id, reminder_days, reminder_key, paid_through_date, created_at, seen_at")
    .eq("member_id", memberId)
    .eq("paid_through_date", paidThrough)
    .is("seen_at", null)
    .order("reminder_days", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    if (!isMissingNotificationsTable(error)) {
      console.error("getCurrentUnseenRenewalNotifications error:", error);
    }
    return [] as any[];
  }

  return data ?? [];
}

export async function markCurrentRenewalNotificationsSeen(args: {
  supabase: any;
  memberId: string;
  paidThroughDate: string | null | undefined;
}) {
  const { supabase, memberId, paidThroughDate } = args;
  const paidThrough = String(paidThroughDate ?? "").slice(0, 10);
  if (!paidThrough) return;

  const { error } = await supabase
    .from("membership_renewal_notifications")
    .update({ seen_at: new Date().toISOString() })
    .eq("member_id", memberId)
    .eq("paid_through_date", paidThrough)
    .is("seen_at", null);

  if (error && !isMissingNotificationsTable(error)) {
    console.error("markCurrentRenewalNotificationsSeen error:", error);
  }
}

export function renewalMessageForDays(daysLeft: number, paidThroughLabel: string) {
  if (daysLeft <= 0) {
    return `Your membership expires today (${paidThroughLabel}). Renew now to avoid interruption.`;
  }
  if (daysLeft === 1) {
    return `Your membership expires tomorrow (${paidThroughLabel}). Renew now to avoid interruption.`;
  }
  return `Your membership expires in ${daysLeft} days (${paidThroughLabel}). Renew now to avoid interruption.`;
}
