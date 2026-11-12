import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function requireStaff(
  roles = ["admin", "front_desk", "security"],
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?staff=1");
  const { data: staff, error } = await supabase
    .from("staff_profiles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (
    error ||
    !staff ||
    staff.is_active === false ||
    !roles.includes(staff.role)
  )
    redirect("/member");
  return { user, staff, supabase, admin: createAdminClient() };
}
