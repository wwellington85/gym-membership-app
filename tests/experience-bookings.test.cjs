const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { fixture, id } = require("./fixtures/booking-db.cjs");
async function setup(clock) {
  const db = await fixture();
  if (clock)
    await db.exec(
      `CREATE OR REPLACE FUNCTION pg_catalog.now() RETURNS timestamptz LANGUAGE sql STABLE AS $$ SELECT timestamptz '${clock}' $$;`,
    );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261114210000_experience_bookings.sql",
      "utf8",
    ),
  );
  await db.exec(
    `UPDATE members SET user_id='${id(101)}' WHERE id='${id(1)}'; UPDATE members SET user_id='${id(102)}' WHERE id='${id(2)}'; INSERT INTO staff_profiles VALUES('${id(33)}','front_desk',true),('${id(34)}','supervisor',true);`,
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261114220000_automatic_cabana_assignment.sql",
      "utf8",
    ),
  );
  return db;
}
const payload = (more = {}) => ({
  product: "cabana_classic",
  date: "2026-11-14",
  start: 540,
  cabana: 1,
  ...more,
});
async function book(
  db,
  key,
  p = payload(),
  actor = id(101),
  member = id(1),
  source = "member",
) {
  return (
    await db.query(`SELECT create_experience_booking($1,$2,$3,$4,$5) AS id`, [
      actor,
      member,
      source,
      id(key),
      p,
    ])
  ).rows[0].id;
}
async function manage(db, booking, action, detail = {}, actor = id(33)) {
  return db.query(`SELECT manage_experience_booking($1,$2,$3,$4)`, [
    actor,
    booking,
    action,
    detail,
  ]);
}
const person = {
  appetizer: "Fish Cake",
  salad: "Tossed Salad",
  main: "Parmesan Chicken",
  sides: ["Herb Mash Potato", "Vegetable Rice"],
  dessert: "Tropical Fruit Salad",
};
async function autoBook(
  db,
  key,
  p = payload(),
  actor = id(101),
  member = id(1),
) {
  return (
    await db.query("SELECT request_member_experience($1,$2,$3,$4) AS id", [
      actor,
      member,
      id(key),
      p,
    ])
  ).rows[0].id;
}
test("guest time requests automatically allocate all three cabanas and reject a fourth hold", async () => {
  const db = await setup();
  try {
    const first = await autoBook(db, 270, payload({ cabana: 3 }));
    await autoBook(db, 271);
    await autoBook(db, 272);
    assert.deepEqual(
      (
        await db.query("SELECT cabana FROM experience_bookings ORDER BY cabana")
      ).rows.map((r) => r.cabana),
      [1, 2, 3],
    );
    assert.equal(await autoBook(db, 270, payload({ cabana: 2 })), first);
    await assert.rejects(
      autoBook(db, 273, payload(), id(102), id(2)),
      /Slot just booked/,
    );
    await assert.rejects(
      autoBook(db, 274, payload(), id(101), id(2)),
      /Active member/,
    );
    await manage(db, first, "cancel", {}, id(101));
    await autoBook(db, 275, payload(), id(102), id(2));
    assert.equal(
      (
        await db.query(
          "SELECT count(*) AS n FROM experience_bookings WHERE status='requested'",
        )
      ).rows[0].n,
      3,
    );
    assert.equal(
      (
        await db.query(
          "SELECT has_function_privilege('authenticated','public.request_member_experience(uuid,uuid,uuid,jsonb)','EXECUTE') AS allowed",
        )
      ).rows[0].allowed,
      false,
    );
  } finally {
    await db.close();
  }
});
test("automatic assignment fills compatible anchored slots first and retries remain stable after staff moves", async () => {
  const db = await setup();
  try {
    await book(db, 280);
    const second = await autoBook(db, 281, payload({ start: 780 }));
    assert.equal(
      (
        await db.query("SELECT cabana FROM experience_bookings WHERE id=$1", [
          second,
        ])
      ).rows[0].cabana,
      1,
    );
    await manage(db, second, "reschedule", {
      date: "2026-11-15",
      start: 660,
      cabana: 3,
    });
    assert.equal(await autoBook(db, 281, payload({ start: 780 })), second);
    await assert.rejects(
      autoBook(db, 281, payload({ start: 840 })),
      /Submission changed/,
    );
    const third = await autoBook(db, 282, payload({ start: 570 }));
    assert.equal(
      (
        await db.query("SELECT cabana FROM experience_bookings WHERE id=$1", [
          third,
        ])
      ).rows[0].cabana,
      2,
    );
  } finally {
    await db.close();
  }
});
test("front desk can confirm a paid rental already in progress, but cannot confirm an ended rental", async () => {
  const db = await setup("2026-11-14 16:10:00+00");
  try {
    await db.query(
      `INSERT INTO experience_bookings(id,created_by,source,product_code,booking_date,start_minute,end_minute,cabana,guest_name,product_snapshot,total,currency,paid_at,paid_by,payment_method,submission_key,request_payload) VALUES($1,$2,'staff','cabana_classic','2026-11-14',540,780,1,'Arrived guest','{"name":"Cabana"}',80,'USD',now(),$2,'cash',$3,'{}'),($4,$2,'staff','cabana_classic','2026-11-14',420,660,2,'Ended rental','{"name":"Cabana"}',80,'USD',now(),$2,'cash',$5,'{}')`,
      [id(260), id(33), id(261), id(262), id(263)],
    );
    await manage(db, id(260), "confirm");
    await assert.rejects(
      manage(db, id(262), "confirm"),
      /Booking time has passed/,
    );
    assert.equal(
      (
        await db.query("SELECT status FROM experience_bookings WHERE id=$1", [
          id(260),
        ])
      ).rows[0].status,
      "confirmed",
    );
  } finally {
    await db.close();
  }
});
test("rescheduling is atomic, preserves paid price, and rejects stale staff actions", async () => {
  const db = await setup();
  try {
    const b = await book(db, 250);
    await manage(db, b, "pay", {
      amount: 80,
      currency: "USD",
      method: "cash",
      reference: "Desk 250",
    });
    await assert.rejects(
      manage(db, b, "confirm", { expected_revision: 0 }),
      /Booking changed/,
    );
    await manage(db, b, "confirm", { expected_revision: 1 });
    await book(db, 251, payload({ cabana: 2 }), id(102), id(2));
    await assert.rejects(
      manage(db, b, "reschedule", {
        date: "2026-11-14",
        start: 540,
        cabana: 2,
      }),
      /Slot just booked/,
    );
    let row = (
      await db.query("SELECT * FROM experience_bookings WHERE id=$1", [b])
    ).rows[0];
    assert.equal(row.cabana, 1);
    assert.equal(row.status, "confirmed");
    assert.equal(row.payment_reference, "Desk 250");
    await manage(db, b, "reschedule", {
      date: "2026-11-15",
      start: 660,
      cabana: 3,
    });
    row = (await db.query("SELECT * FROM experience_bookings WHERE id=$1", [b]))
      .rows[0];
    assert.equal(row.cabana, 3);
    assert.equal(row.start_minute, 660);
    assert.equal(row.total, "80.00");
    assert.equal(row.status, "confirmed");
    await book(db, 252, payload(), id(102), id(2));
  } finally {
    await db.close();
  }
});
test("cabana holds anchor two slots, prevent overlaps, release on cancellation, and reject changed duplicate submissions", async () => {
  const db = await setup();
  try {
    const b = await book(db, 200);
    assert.equal(await book(db, 200), b);
    assert.equal(
      (await db.query("SELECT first_start FROM cabana_days")).rows[0]
        .first_start,
      540,
    );
    await assert.rejects(book(db, 201), /Slot just booked/);
    await assert.rejects(
      book(db, 202, payload({ start: 570 })),
      /Schedule changed/,
    );
    await assert.rejects(
      book(db, 200, payload({ cabana: 2 })),
      /Submission changed/,
    );
    await book(db, 203, payload({ start: 780 }));
    await assert.rejects(
      book(db, 204, payload({ start: 630, cabana: 2 })),
      /available four-hour/,
    );
    await manage(db, b, "cancel", {}, id(101));
    await book(db, 205, payload(), id(102), id(2));
    assert.equal(
      (
        await db.query(
          `SELECT count(*) AS n FROM experience_bookings WHERE status='requested' AND cabana=1`,
        )
      ).rows[0].n,
      2,
    );
    await book(db, 206, payload({ cabana: 2, start: 840 }));
    assert.equal(
      (await db.query("SELECT first_start FROM cabana_days WHERE cabana=2"))
        .rows[0].first_start,
      600,
    );
  } finally {
    await db.close();
  }
});
test("payment, confirmation, cancellation, refund and permission boundaries are enforced atomically", async () => {
  const db = await setup();
  try {
    const b = await book(db, 210);
    await assert.rejects(manage(db, b, "confirm"), /Record payment/);
    await assert.rejects(
      manage(db, b, "pay", {
        amount: 1,
        currency: "USD",
        method: "cash",
        reference: "Receipt",
      }),
      /must match/,
    );
    await assert.rejects(
      manage(
        db,
        b,
        "pay",
        { amount: 80, currency: "USD", method: "cash", reference: "Receipt" },
        id(31),
      ),
      /Not authorized/,
    );
    await assert.rejects(
      manage(db, b, "cancel", {}, id(102)),
      /Not authorized/,
    );
    await manage(db, b, "pay", {
      amount: 80,
      currency: "USD",
      method: "cash",
      reference: "Receipt 1",
    });
    await manage(db, b, "pay", {
      amount: 80,
      currency: "USD",
      method: "cash",
      reference: "Receipt 1",
    });
    await assert.rejects(
      manage(db, b, "cancel", {}, id(101)),
      /Contact the front desk/,
    );
    await manage(db, b, "confirm", {}, id(34));
    await assert.rejects(manage(db, b, "complete"), /after it starts/);
    await manage(db, b, "cancel", { reason: "Guest changed plans" });
    assert.ok(
      (
        await db.query("SELECT paid_at FROM experience_bookings WHERE id=$1", [
          b,
        ])
      ).rows[0].paid_at,
    );
    assert.equal(
      (
        await db.query(
          "SELECT refunded_at FROM experience_bookings WHERE id=$1",
          [b],
        )
      ).rows[0].refunded_at,
      null,
    );
    await manage(db, b, "refund", {
      reason: "Cancellation refund",
      reference: "Refund 1",
    });
    await manage(db, b, "refund", {
      reason: "Cancellation refund",
      reference: "Refund 1",
    });
    assert.ok(
      (
        await db.query(
          "SELECT refunded_at FROM experience_bookings WHERE id=$1",
          [b],
        )
      ).rows[0].refunded_at,
    );
    assert.equal(
      (
        await db.query(
          `SELECT count(*) AS n FROM club_audit_events WHERE action='experience_pay'`,
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM access_passes")).rows[0].n,
      0,
    );
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM checkins")).rows[0].n,
      0,
    );
    for (const table of [
      "experience_bookings",
      "cabana_days",
      "experience_products",
    ])
      assert.equal(
        (
          await db.query(
            `SELECT has_table_privilege('authenticated','public.${table}','SELECT') AS allowed`,
          )
        ).rows[0].allowed,
        false,
      );
    assert.equal(
      (
        await db.query(
          `SELECT has_function_privilege('authenticated','public.create_experience_booking(uuid,uuid,text,uuid,jsonb)','EXECUTE') AS allowed`,
        )
      ).rows[0].allowed,
      false,
    );
  } finally {
    await db.close();
  }
});
test("dinner validates per-guest menu, lead time, frozen totals and staff availability check", async () => {
  const db = await setup();
  try {
    const p = payload({
      product: "starlight",
      cabana: null,
      start: 1080,
      menu: [person, person],
    });
    await assert.rejects(
      book(db, 220, { ...p, date: "2026-11-12" }),
      /24 hours/,
    );
    await assert.rejects(
      book(db, 221, { ...p, menu: [person] }),
      /complete menu/,
    );
    await assert.rejects(
      book(db, 222, {
        ...p,
        menu: [
          { ...person, sides: ["Vegetable Rice", "Vegetable Rice"] },
          person,
        ],
      }),
      /complete menu/,
    );
    await assert.rejects(
      book(db, 223, {
        ...p,
        menu: [{ ...person, main: "Unlisted item" }, person],
      }),
      /complete menu/,
    );
    const b = await book(db, 224, p);
    const row = (
      await db.query("SELECT * FROM experience_bookings WHERE id=$1", [b])
    ).rows[0];
    assert.equal(row.total, "168.00");
    await db.exec(
      `UPDATE experience_products SET price=200 WHERE code='starlight'`,
    );
    assert.equal(
      (await db.query("SELECT total FROM experience_bookings WHERE id=$1", [b]))
        .rows[0].total,
      "168.00",
    );
    await manage(db, b, "pay", {
      amount: 168,
      currency: "USD",
      method: "card",
      reference: "Card receipt",
    });
    await assert.rejects(manage(db, b, "confirm"), /availability first/);
    await manage(db, b, "confirm", { availability_checked: true });
  } finally {
    await db.close();
  }
});
test("front desk can hold walk-ins without creating member accounts; inactive staff and forged ownership fail", async () => {
  const db = await setup();
  try {
    const p = payload({ guest_name: "Walk-in guest", phone: "8765550100" });
    await book(db, 230, p, id(33), null, "staff");
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM members")).rows[0].n,
      2,
    );
    await assert.rejects(
      book(db, 231, { ...p, cabana: 2 }, id(32), null, "staff"),
      /Not authorized/,
    );
    await assert.rejects(
      book(db, 232, { ...p, cabana: 2 }, id(101), id(2)),
      /Active member/,
    );
    await assert.rejects(
      book(db, 233, { ...p, cabana: 2, phone: "" }, id(33), null, "staff"),
      /phone, email or room/,
    );
  } finally {
    await db.close();
  }
});
