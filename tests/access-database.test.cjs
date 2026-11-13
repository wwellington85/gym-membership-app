const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function fixture(applyCompatibility = true) {
  const db = new PGlite();
  await db.exec(`
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
  await db.exec(readFileSync("tests/fixtures/legacy-payment-schema.sql", "utf8"));
  await db.exec(
    readFileSync(
      "supabase/migrations/20261112140000_loyalty_access_and_payment_fulfilment.sql",
      "utf8",
    ),
  );
  if (applyCompatibility) await db.exec(readFileSync("supabase/migrations/20261112210000_payment_schema_compatibility.sql", "utf8"));
  return db;
}
async function order(db, paymentId = id(40), member = id(1), amount = 25) {
  await db.query(
    `INSERT INTO payments(id,member_id,membership_id,amount,currency,provider,provider_reference,status,purchased_plan_id,purchase_snapshot,access_start_date,access_end_date) SELECT $1,$2,id,$3,'USD','fygaro','checkout-reference','pending',$4,(SELECT to_jsonb(p) FROM membership_plans p WHERE p.id=$4),(now() AT TIME ZONE 'America/Jamaica')::date,(now() AT TIME ZONE 'America/Jamaica')::date FROM memberships WHERE member_id=$2`,
    [paymentId, member, amount, id(11)],
  );
}
async function fulfil(
  db,
  payment = id(40),
  transaction = "transaction-1",
  amount = 25,
) {
  return db.query(
    `SELECT fulfil_access_payment($1,$2,'reference',$3,'USD') AS id`,
    [payment, transaction, amount],
  );
}

test("migration, frozen fulfilment, idempotency, permissions, and atomic rollback", async () => {
  const db = await fixture();
  try {
    const products = (
      await db.query(
        `SELECT code,price,access_scope FROM membership_plans ORDER BY price`,
      )
    ).rows;
    assert.equal(products.find((p) => p.code === "gym_day").price, "15");
    assert.equal(products.find((p) => p.code === "club_day").price, "25");
    assert.equal(
      products.find((p) => p.code === "gym_day").access_scope,
      "gym",
    );
    assert.equal(
      (
        await db.query(
          `SELECT has_table_privilege('authenticated','public.payments','INSERT') AS allowed`,
        )
      ).rows[0].allowed,
      false,
    );
    assert.equal(
      (
        await db.query(
          `SELECT has_function_privilege('authenticated','public.fulfil_access_payment(uuid,text,text,numeric,text)','EXECUTE') AS allowed`,
        )
      ).rows[0].allowed,
      false,
    );
    await order(db);
    await assert.rejects(fulfil(db, id(40), "transaction-1", 1), /match/);
    assert.equal(
      (await db.query(`SELECT status FROM payments WHERE id=$1`, [id(40)]))
        .rows[0].status,
      "pending",
    );
    await db.exec(
      `CREATE FUNCTION fail_pass() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated access failure'; END $$; CREATE TRIGGER fail_pass BEFORE INSERT ON access_passes FOR EACH ROW EXECUTE FUNCTION fail_pass();`,
    );
    await assert.rejects(fulfil(db), /simulated access failure/);
    assert.equal(
      (
        await db.query(`SELECT status,fulfilled_at FROM payments WHERE id=$1`, [
          id(40),
        ])
      ).rows[0].fulfilled_at,
      null,
    );
    await db.exec("DROP TRIGGER fail_pass ON access_passes");
    await fulfil(db);
    await fulfil(db);
    const passes = (
      await db.query(`SELECT * FROM access_passes WHERE payment_id=$1`, [
        id(40),
      ])
    ).rows;
    assert.equal(passes.length, 1);
    assert.equal(
      String(passes[0].start_date),
      String(passes[0].paid_through_date),
    );
    assert.ok(
      (
        await db.query(`SELECT fulfilled_at FROM payments WHERE id=$1`, [
          id(40),
        ])
      ).rows[0].fulfilled_at,
    );
    assert.equal(
      (
        await db.query(`SELECT plan_id FROM memberships WHERE member_id=$1`, [
          id(1),
        ])
      ).rows[0].plan_id,
      id(10),
    );
    await order(db, id(41), id(2));
    await assert.rejects(
      fulfil(db, id(41), "transaction-1"),
      /already assigned/,
    );
    await assert.rejects(
      fulfil(db, id(40), "different-transaction"),
      /mismatch/,
    );
    await db.exec(`INSERT INTO app_settings VALUES('points_per_checkin',0)`);
    assert.equal(
      (
        await db.query("SELECT record_gym_visit($1,$2) AS saved", [
          id(1),
          id(31),
        ])
      ).rows[0].saved,
      true,
    );
    assert.equal(
      (await db.query("SELECT points_earned FROM checkins")).rows[0]
        .points_earned,
      0,
    );
    assert.equal(
      (
        await db.query("SELECT record_gym_visit($1,$2) AS saved", [
          id(1),
          id(31),
        ])
      ).rows[0].saved,
      false,
    );
    await assert.rejects(
      db.query("SELECT record_gym_visit($1,$2)", [id(2), id(31)]),
      /No valid gym access/,
    );
    await db.query("UPDATE members SET is_active=false WHERE id=$1", [id(1)]);
    await assert.rejects(
      db.query("SELECT record_gym_visit($1,$2)", [id(1), id(31)]),
      /inactive/,
    );
    await assert.rejects(
      db.query("SELECT record_gym_visit($1,$2)", [id(1), id(32)]),
      /authorised/,
    );
  } finally {
    await db.close();
  }
});
test("directory filters precede pagination and inactive identities can be found", async () => {
  const db = await fixture();
  try {
    await db.exec(
      `INSERT INTO members(full_name) SELECT 'Member ' || n FROM generate_series(1,70) n; UPDATE members SET is_active=false WHERE email='two@example.com';`,
    );
    assert.equal(
      (
        await db.query(
          `SELECT * FROM search_club_members('two@example.com','inactive',0,25)`,
        )
      ).rows[0].full_name,
      "Guest Two",
    );
    assert.equal(
      (
        await db.query(
          `SELECT * FROM search_club_members('Member 70','all',0,25)`,
        )
      ).rows[0].full_name,
      "Member 70",
    );
    const first = (
      await db.query(`SELECT * FROM search_club_members('','all',0,25)`)
    ).rows;
    assert.equal(first.length, 25);
    assert.equal(Number(first[0].total), 71);
    const next = (
      await db.query(`SELECT * FROM search_club_members('','all',1,25)`)
    ).rows;
    assert.ok(!first.some((a) => next.some((b) => b.id === a.id)));
  } finally {
    await db.close();
  }
});

test("staff grants, revocation, benefit use and schedule application use independent, auditable transactions", async () => {
  const db = await fixture();
  try {
    const today = (
      await db.query(
        `SELECT (now() AT TIME ZONE 'America/Jamaica')::date AS day`,
      )
    ).rows[0].day;
    const args = [
      id(1),
      id(11),
      today,
      true,
      "cash",
      25,
      "Desk sale",
      id(30),
      id(50),
    ];
    const grant = `SELECT grant_staff_access($1,$2,$3,$4,$5,$6,$7,$8,$9) AS id`;
    const pass = (await db.query(grant, args)).rows[0].id;
    assert.equal((await db.query(grant, args)).rows[0].id, pass);
    assert.equal(
      Number(
        (
          await db.query(`SELECT count(*) FROM access_passes WHERE source=$1`, [
            `staff:${id(50)}`,
          ])
        ).rows[0].count,
      ),
      1,
    );
    await assert.rejects(
      db.query(grant, [...args.slice(0, 7), id(31), id(51)]),
      /authorised/,
    );
    const used = (
      await db.query(
        `SELECT record_benefit_use($1,'restaurant','BILL-1',$2,$3) AS id`,
        [id(1), id(30), id(60)],
      )
    ).rows[0].id;
    assert.equal(
      (
        await db.query(
          `SELECT record_benefit_use($1,'restaurant','BILL-1',$2,$3) AS id`,
          [id(1), id(30), id(60)],
        )
      ).rows[0].id,
      used,
    );
    assert.equal(
      Number(
        (
          await db.query(
            "SELECT discount_percent FROM benefit_uses WHERE id=$1",
            [used],
          )
        ).rows[0].discount_percent,
      ),
      10,
    );
    await assert.rejects(
      db.query(`SELECT record_benefit_use($1,'restaurant','BILL-1',$2,$3)`, [
        id(1),
        id(30),
        id(61),
      ]),
      /unique/,
    );
    await assert.rejects(
      db.query(`SELECT record_benefit_use($1,'restaurant','BILL-2',$2,$3)`, [
        id(1),
        id(31),
        id(62),
      ]),
      /authorised/,
    );
    assert.equal(
      Number((await db.query("SELECT count(*) FROM checkins")).rows[0].count),
      0,
    );
    await db.query(
      `SELECT revoke_access_pass($1,$2,$3,'Guest requested cancellation')`,
      [pass, id(1), id(30)],
    );
    assert.equal(
      (await db.query("SELECT status FROM access_passes WHERE id=$1", [pass]))
        .rows[0].status,
      "revoked",
    );
    const baseUse = (
      await db.query(
        `SELECT record_benefit_use($1,'spa','BILL-2',$2,$3) AS id`,
        [id(1), id(30), id(63)],
      )
    ).rows[0].id;
    assert.equal(
      Number(
        (
          await db.query(
            "SELECT discount_percent FROM benefit_uses WHERE id=$1",
            [baseUse],
          )
        ).rows[0].discount_percent,
      ),
      5,
    );
    await db.query(
      `INSERT INTO membership_plan_scheduled_updates(plan_id,effective_on,discount_food) VALUES($1,(now() AT TIME ZONE 'America/Jamaica')::date,.07)`,
      [id(10)],
    );
    assert.equal(
      (await db.query(`SELECT apply_due_programme_updates() AS count`)).rows[0]
        .count,
      1,
    );
    assert.equal(
      (await db.query(`SELECT apply_due_programme_updates() AS count`)).rows[0]
        .count,
      0,
    );
    assert.ok(
      Number(
        (await db.query("SELECT count(*) FROM club_audit_events")).rows[0]
          .count,
      ) >= 5,
    );
    const overview = (await db.query(`SELECT club_overview() AS data`)).rows[0]
      .data;
    assert.equal(overview.benefit_uses_30d, 2);
    assert.equal(overview.access, 0);
  } finally {
    await db.close();
  }
});

test("legacy payment constraint reproduces the failure; compatibility fix grants one complimentary monthly pass without extending Rewards", async () => {
  const db = await fixture(false);
  try {
    await db.query(`INSERT INTO membership_plans(id,code,name,price,duration_days,plan_type,grants_access,access_scope) VALUES($1,'club_monthly_95','Club Monthly',95,30,'pass',true,'resort')`, [id(12)]);
    const before = (await db.query('SELECT * FROM memberships WHERE member_id=$1', [id(1)])).rows[0];
    const args = [id(1), id(12), '2026-11-12', true, 'complimentary', 0, 'Approved complimentary membership', id(30), id(80)];
    const grant = 'SELECT grant_staff_access($1,$2,$3,$4,$5,$6,$7,$8,$9) AS id';
    await assert.rejects(db.query(grant, args), /payments_status_check/);
    assert.equal(Number((await db.query('SELECT count(*) FROM payments')).rows[0].count), 0);
    assert.equal(Number((await db.query('SELECT count(*) FROM access_passes')).rows[0].count), 0);
    await db.exec(readFileSync('supabase/migrations/20261112210000_payment_schema_compatibility.sql', 'utf8'));
    const passId = (await db.query(grant, args)).rows[0].id;
    assert.equal((await db.query(grant, args)).rows[0].id, passId);
    const receipt = (await db.query('SELECT * FROM payments')).rows[0];
    assert.equal(receipt.status, 'paid');
    assert.equal(Number(receipt.amount), 0);
    assert.equal(receipt.payment_method, 'complimentary');
    assert.equal(receipt.method, 'complimentary');
    assert.deepEqual(receipt.payment_date, receipt.paid_on);
    const pass = (await db.query('SELECT * FROM access_passes')).rows[0];
    assert.equal(new Date(pass.start_date).toISOString().slice(0, 10), '2026-11-12');
    assert.equal(new Date(pass.paid_through_date).toISOString().slice(0, 10), '2026-12-11');
    assert.equal(pass.payment_id, receipt.id);
    assert.deepEqual((await db.query('SELECT * FROM memberships WHERE member_id=$1', [id(1)])).rows[0], before);
    assert.equal(Number((await db.query('SELECT count(*) FROM payments')).rows[0].count), 1);
    assert.ok(Number((await db.query('SELECT count(*) FROM club_audit_events')).rows[0].count) >= 1);
    await assert.rejects(db.query(`UPDATE payments SET status='unrecognised' WHERE id=$1`, [receipt.id]), /payments_status_check/);
    await db.exec(readFileSync('supabase/migrations/20261112210000_payment_schema_compatibility.sql', 'utf8'));
    assert.equal((await db.query(grant, args)).rows[0].id, passId);
  } finally { await db.close(); }
});
