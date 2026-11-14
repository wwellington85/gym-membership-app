const { readFileSync } = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function fixture(applyCompatibility = true) {
  const db = new PGlite();
  // Keep real migration functions under test, but freeze their SQL clock at
  // daytime in the isolated database so day-pass tests do not expire at 10 pm.
  await db.exec(`
    CREATE OR REPLACE FUNCTION pg_catalog.now() RETURNS timestamptz
      LANGUAGE sql STABLE AS $$ SELECT timestamptz '2026-11-12 15:00:00+00' $$;
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
    CREATE TABLE public.members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,full_name text,phone text,email text,is_active boolean DEFAULT true,created_at timestamptz DEFAULT now());
    CREATE TABLE public.staff_profiles(user_id uuid PRIMARY KEY,role text,is_active boolean);
    CREATE TABLE public.membership_plans(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text UNIQUE,name text,price numeric,duration_days integer,plan_type text,grants_access boolean,is_active boolean DEFAULT true,visible_on_join boolean DEFAULT true,discount_food numeric,discount_spa numeric,discount_giftshop numeric,discount_watersports numeric);
    CREATE TABLE public.memberships(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),member_id uuid UNIQUE REFERENCES members(id),plan_id uuid REFERENCES membership_plans(id),status text,start_date date,paid_through_date date NOT NULL);
    CREATE TABLE public.payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),membership_id uuid REFERENCES memberships(id),member_id uuid REFERENCES members(id),amount numeric,currency text,status text,provider text,provider_reference text,provider_payment_id text,paid_on date,payment_method text,staff_user_id uuid,notes text,created_at timestamptz DEFAULT now());
    CREATE TABLE public.checkins(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),member_id uuid REFERENCES members(id),staff_user_id uuid,points_earned integer,checked_in_at timestamptz DEFAULT now());
    CREATE TABLE public.app_settings(key text PRIMARY KEY,int_value integer);
    CREATE TABLE public.membership_applications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),status text);
    CREATE TABLE public.membership_plan_benefits(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),plan_id uuid,label text,value text,sort_order integer,is_active boolean);
    CREATE TABLE public.membership_plan_scheduled_updates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),plan_id uuid,effective_on date,discount_food numeric,discount_spa numeric,discount_giftshop numeric,discount_watersports numeric,grants_access boolean,visible_on_join boolean,applied_at timestamptz,created_at timestamptz DEFAULT now());
    INSERT INTO members(id,full_name,email) VALUES('${id(1)}','Guest One','one@example.com'),('${id(2)}','Guest Two','two@example.com');
    INSERT INTO membership_plans(id,code,name,price,duration_days,plan_type,grants_access,discount_food,discount_spa,discount_giftshop,discount_watersports) VALUES('${id(10)}','rewards_free','Rewards',0,3650,'rewards',false,.05,.05,.05,.05),('${id(11)}','club_day','Day',15,1,'pass',true,.1,.1,.1,.1);
    INSERT INTO memberships(id,member_id,plan_id,status,start_date,paid_through_date) VALUES('${id(20)}','${id(1)}','${id(10)}','active',current_date,current_date+3650),('${id(21)}','${id(2)}','${id(10)}','active',current_date,current_date+3650);
    INSERT INTO staff_profiles VALUES('${id(30)}','admin',true),('${id(31)}','security',true),('${id(32)}','front_desk',false);
    GRANT INSERT,UPDATE ON public.payments TO authenticated;
  `);
  await db.exec(
    readFileSync("tests/fixtures/legacy-payment-schema.sql", "utf8"),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261112140000_loyalty_access_and_payment_fulfilment.sql",
      "utf8",
    ),
  );
  if (applyCompatibility)
    await db.exec(
      readFileSync(
        "supabase/migrations/20261112210000_payment_schema_compatibility.sql",
        "utf8",
      ),
    );
  return db;
}

module.exports = { fixture, id };
