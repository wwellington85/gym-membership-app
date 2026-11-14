const { test } = require("node:test");
const assert = require("node:assert/strict");
const { PGlite } = require("@electric-sql/pglite");
const { readFileSync } = require("node:fs");
test("Club visits share one daily award across staff and legacy entry points, without paid access", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE members(id uuid PRIMARY KEY,is_active boolean);
 CREATE TABLE staff_profiles(user_id uuid,role text,is_active boolean);
 CREATE TABLE checkins(member_id uuid,staff_user_id uuid,points_earned integer,checked_in_at timestamptz DEFAULT now());
 INSERT INTO members VALUES('00000000-0000-4000-8000-000000000001',true),('00000000-0000-4000-8000-000000000002',false);
 INSERT INTO staff_profiles VALUES('00000000-0000-4000-8000-000000000003','security',true),('00000000-0000-4000-8000-000000000004','front_desk',true),('00000000-0000-4000-8000-000000000005','front_desk',false);`);
    await db.exec(
      readFileSync(
        "supabase/migrations/20261114010000_club_property_visits.sql",
        "utf8",
      ),
    );
    const member = "00000000-0000-4000-8000-000000000001",
      gate = "00000000-0000-4000-8000-000000000003",
      restaurant = "00000000-0000-4000-8000-000000000004";
    const call = async (fn, staff = gate, id = member) =>
      (await db.query(`SELECT ${fn}($1,$2) AS saved`, [id, staff])).rows[0]
        .saved;
    assert.equal(await call("record_club_visit"), true);
    assert.equal(await call("record_club_visit", restaurant), false);
    assert.equal(await call("record_gym_visit", restaurant), false);
    assert.deepEqual(
      (await db.query("SELECT points_earned FROM checkins")).rows,
      [{ points_earned: 3 }],
    );
    await db.exec("UPDATE checkins SET checked_in_at=now()-interval '1 day'");
    assert.equal(await call("record_club_visit", restaurant), true);
    assert.equal(
      (await db.query("SELECT club_visit_points($1)::int AS points", [member]))
        .rows[0].points,
      6,
    );
    await assert.rejects(
      call("record_club_visit", gate, "00000000-0000-4000-8000-000000000002"),
      /inactive/,
    );
    await assert.rejects(
      call("record_club_visit", "00000000-0000-4000-8000-000000000005"),
      /authorised/,
    );
    assert.equal(
      (
        await db.query(
          "SELECT has_function_privilege('authenticated','record_club_visit(uuid,uuid)','execute') AS allowed",
        )
      ).rows[0].allowed,
      false,
    );
  } finally {
    await db.close();
  }
});
