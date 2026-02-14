import { createClient } from "@/lib/supabase/server";
import MemberForm from "./MemberForm";
import { createMember } from "./actions";

type PlanRow = {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  plan_type?: string | null;
  code?: string | null;
};


function todayJamaicaISO() {
  // en-CA gives YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Jamaica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}



export default async function NewMemberPage() {
  const supabase = await createClient();

  const { data: plansRaw, error: plansError } = await supabase
    .from("membership_plans")
    .select("id,name,price,duration_days,plan_type,code,is_active")
    .order("price", { ascending: true });

  const plans = ((plansRaw as any) ?? []) as PlanRow[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Add Club Member</h1>
        <p className="text-sm opacity-70">Create a profile and assign a plan</p>
      </div>

      {plansError ? (
        <div className="oura-alert-warning p-3 text-sm">
          <div className="font-medium">Could not load membership plans</div>
          <div className="mt-1 opacity-70">{plansError.message}</div>
        </div>
      ) : null}

      <MemberForm
plans={plans} action={createMember} />
    </div>
  );
}
