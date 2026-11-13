const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
const vm = require("node:vm"),
  ts = require("typescript");
const migration = readFileSync(
  "supabase/migrations/20261113010000_permanent_member_numbers.sql",
  "utf8",
);
async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),full_name text,phone text,email text,is_active boolean DEFAULT true);
 CREATE TABLE membership_plans(code text); INSERT INTO membership_plans VALUES('rewards_free');
 CREATE TABLE access_passes(member_id uuid REFERENCES members(id),status text,start_date date,paid_through_date date,plan_snapshot jsonb);
 INSERT INTO members(id,full_name,email) VALUES ('00000000-0000-4000-8000-000000000001','Example Member','one@example.com'),('00000000-0000-4000-8000-000000000002','Another Member','two@example.com');
 INSERT INTO access_passes VALUES ('00000000-0000-4000-8000-000000000001','active',current_date,current_date+30,'{"access_scope":"gym"}');`);
  return db;
}
test("membership numbers backfill uniquely and retain UUIDs, access relations, and numbers on rerun", async () => {
  const db = await fixture();
  try {
    await db.exec(migration);
    const before = (
      await db.query("SELECT id,member_number FROM members ORDER BY id")
    ).rows;
    assert.equal(before.length, 2);
    assert.equal(new Set(before.map((x) => x.member_number)).size, 2);
    for (const row of before)
      assert.match(String(row.member_number), /^[1-9]\d{11}$/);
    assert.equal(before[0].id, "00000000-0000-4000-8000-000000000001");
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM access_passes JOIN members ON members.id=access_passes.member_id",
        )
      ).rows[0].n,
      1,
    );
    await db.exec(migration);
    assert.deepEqual(
      (await db.query("SELECT id,member_number FROM members ORDER BY id")).rows,
      before,
    );
    const created = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        db.query(
          "INSERT INTO members(full_name) VALUES($1) RETURNING member_number",
          [`New ${i}`],
        ),
      ),
    );
    assert.equal(new Set(created.map((r) => r.rows[0].member_number)).size, 30);
    await assert.rejects(
      db.query("UPDATE members SET member_number=482700000000 WHERE id=$1", [
        before[0].id,
      ]),
      /only be updated to DEFAULT|permanent/,
    );
    await assert.rejects(
      db.query("UPDATE members SET member_number=DEFAULT WHERE id=$1", [
        before[0].id,
      ]),
      /permanent/,
    );
    await assert.rejects(
      db.query(
        "INSERT INTO members(full_name,member_number) VALUES('Chosen',482700000000)",
      ),
      /cannot insert a non-DEFAULT value/,
    );
    await assert.rejects(
      db.query(
        "INSERT INTO members(full_name,member_number) OVERRIDING SYSTEM VALUE VALUES('Duplicate',$1)",
        [before[0].member_number],
      ),
      /unique/,
    );
  } finally {
    await db.close();
  }
});
test("staff search accepts grouped assigned number and legacy UUID references; no public RPC grants", async () => {
  const db = await fixture();
  try {
    await db.exec(migration);
    const member = (
      await db.query("SELECT id,member_number FROM members ORDER BY id LIMIT 1")
    ).rows[0];
    const grouped = String(member.member_number).match(/.{4}/g).join(" ");
    for (const q of [
      grouped,
      String(member.member_number),
      member.id,
      `TC-${member.id.replaceAll("-", "")}`,
    ]) {
      const result = await db.query(
        "SELECT id FROM search_club_members($1,'all_records',0,25)",
        [q],
      );
      assert.equal(result.rows[0]?.id, member.id);
    }
    await db.exec("SET ROLE authenticated");
    await assert.rejects(
      db.query("SELECT * FROM search_club_members('','all_records',0,25)"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
test("number formatter preserves all digits and rejects suffixes or UUIDs as new numbers", () => {
  function load(path, imports = {}) {
    const exports = {};
    vm.runInNewContext(
      ts.transpileModule(readFileSync(path, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
      }).outputText,
      { exports, Date, Intl, require: (n) => imports[n] },
    );
    return exports;
  }
  const status = load("lib/membership/status.ts");
  const rules = load("lib/access/rules.ts", {
    "@/lib/membership/status": status,
  });
  assert.equal(rules.formatMemberNumber(482719368052), "4827 1936 8052");
  assert.equal(rules.formatMemberNumber("4827193680520041"), "4827 1936 8052 0041");
  assert.equal(rules.formatMemberNumber("9999999999999999"), "9999 9999 9999 9999");
  assert.equal(rules.normalizeMemberNumber(9007199254740992), null);
  assert.equal(rules.normalizeMemberNumber("4827 1936 8052"), "482719368052");
  assert.equal(rules.normalizeMemberNumber("4827-1936-8052"), "482719368052");
  for (const value of [
    "…64746D2B",
    "19368052",
    "00000000-0000-4000-8000-000000000001",
    null,
    {},
    "0000 0000 0001",
  ])
    assert.equal(rules.normalizeMemberNumber(value), null);
});

test("16-digit extension preserves UUIDs, maps old numbers once, and keeps exact text above JS precision", async () => {
  const db = await fixture();
  try {
    await db.exec(migration);
    const before = (
      await db.query("SELECT id,member_number FROM members ORDER BY id")
    ).rows;
    const extend = readFileSync(
      "supabase/migrations/20261113020000_sixteen_digit_member_numbers.sql",
      "utf8",
    );
    await db.exec(extend);
    const after = (
      await db.query("SELECT id,member_number FROM members ORDER BY id")
    ).rows;
    for (let i = 0; i < before.length; i++) {
      assert.equal(after[i].id, before[i].id);
      assert.equal(
        after[i].member_number,
        String(before[i].member_number) + "0041",
      );
      assert.equal(typeof after[i].member_number, "string");
    }
    await db.exec(extend);
    assert.deepEqual(
      (await db.query("SELECT id,member_number FROM members ORDER BY id")).rows,
      after,
    );
    const grouped = after[0].member_number.match(/.{4}/g).join(" ");
    for (const q of [
      grouped,
      after[0].member_number,
      String(before[0].member_number),
      after[0].id,
      `TC-${after[0].id.replaceAll("-", "")}`,
    ]) {
      assert.equal(
        (
          await db.query(
            "SELECT id FROM search_club_members($1,'all_records',0,25)",
            [q],
          )
        ).rows[0]?.id,
        after[0].id,
      );
    }
    const next = (
      await db.query(
        "INSERT INTO members(full_name) VALUES('New') RETURNING member_number",
      )
    ).rows[0].member_number;
    assert.match(next, /^[1-9]\d{15}$/);
    await assert.rejects(
      db.query(
        "UPDATE members SET member_number='4827193680520041' WHERE id=$1",
        [after[0].id],
      ),
      /permanent/,
    );
    await assert.rejects(
      db.query(
        "INSERT INTO members(full_name,member_number) VALUES('Chosen','4827193680520041')",
      ),
      /assigned automatically/,
    );
    await db.exec(
      "SELECT setval('club_member_number_16_seq',9999999999999999,false)",
    );
    const high = (
      await db.query(
        "INSERT INTO members(full_name) VALUES('Exact text') RETURNING member_number",
      )
    ).rows[0].member_number;
    assert.equal(high, "9999999999999999");
    await assert.rejects(
      db.query("INSERT INTO members(full_name) VALUES('Exhausted')"),
      /maximum value/,
    );
  } finally {
    await db.close();
  }
});
