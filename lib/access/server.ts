import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  accessScope,
  passIsActive,
  type AccessPass,
  type AccessPlan,
} from "./rules";

export async function requireMember() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?returnTo=/member");
  const admin = createAdminClient();
  const { data: member, error } = await admin
    .from("members")
    .select("id, full_name, email, phone, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error)
    throw new Error("We could not load your membership. Please try again.");
  if (!member) redirect("/join");
  return { supabase, admin, user, member };
}

export async function loadAccess(memberId: string, active = true) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("access_passes")
    .select("*")
    .eq("member_id", memberId)
    .order("paid_through_date", { ascending: false });
  if (error)
    throw new Error(
      "Access information is temporarily unavailable. Please ask the front desk to verify your pass.",
    );
  const passes = (data ?? []) as AccessPass[];
  const current = active ? passes.filter((p) => passIsActive(p)) : [];
  const best =
    [...current].sort(
      (a, b) =>
        Number(accessScope(b.plan_snapshot) === "resort") -
        Number(accessScope(a.plan_snapshot) === "resort"),
    )[0] ?? null;
  return {
    passes,
    current,
    best,
    gym: current.some((p) => accessScope(p.plan_snapshot) !== "none"),
    resort: current.some((p) => accessScope(p.plan_snapshot) === "resort"),
  };
}

export async function loadCatalogue(includeHidden = false) {
  let query = createAdminClient()
    .from("membership_plans")
    .select(
      "id, code, name, price, duration_days, grants_access, access_scope, discount_food, discount_spa, discount_giftshop, discount_watersports",
    )
    .eq("is_active", true)
    .order("price", { ascending: true });
  if (!includeHidden)
    query = query.or("visible_on_join.eq.true,code.eq.rewards_free");
  const { data, error } = await query;
  if (error)
    throw new Error(
      "We could not load current products. Please try again or ask the front desk.",
    );
  return (data ?? []) as AccessPlan[];
}
