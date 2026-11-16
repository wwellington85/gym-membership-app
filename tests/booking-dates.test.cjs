const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
const { renderToStaticMarkup } = require("react-dom/server");
function load(path, imports = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    {
      exports,
      Intl,
      Date,
      require: (name) => {
        assert.ok(name in imports, name);
        return imports[name];
      },
    },
  );
  return exports;
}
const status = load("lib/membership/status.ts");
const catalogue = load("lib/bookings/catalogue.ts");
const dates = load("lib/bookings/dates.ts", {
  "@/lib/membership/status": status,
  "./catalogue": catalogue,
});
function server(days = [], slots = [], error = false) {
  const calls = [];
  const admin = {
    from(table) {
      const filters = {};
      calls.push({ table, filters });
      const q = {
        select(columns) {
          assert.doesNotMatch(columns, /guest_name|email|phone/);
          return q;
        },
        gte(key, value) {
          filters.min = value;
          return q;
        },
        lte(key, value) {
          filters.max = value;
          return q;
        },
        not() {
          return q;
        },
        in(key, value) {
          filters.statuses = value;
          return q;
        },
        order() {
          return q;
        },
        limit(n) {
          assert.equal(n, 1000);
          return Promise.resolve({
            data: (table === "cabana_days" ? days : slots).filter(
              (row) =>
                row.booking_date >= filters.min &&
                row.booking_date <= filters.max,
            ),
            error: error ? { message: "offline" } : null,
          });
        },
      };
      return q;
    },
  };
  return {
    calls,
    ...load("lib/bookings/server.ts", {
      "@/lib/supabase/admin": { createAdminClient: () => admin },
      "./catalogue": catalogue,
      "@/lib/membership/status": status,
    }),
  };
}
function soldOut(date) {
  return {
    days: [1, 2, 3].map((cabana) => ({
      booking_date: date,
      cabana,
      first_start: 420,
    })),
    slots: [1, 2, 3].flatMap((cabana) =>
      [420, 660].map((start_minute) => ({
        booking_date: date,
        cabana,
        start_minute,
      })),
    ),
  };
}
test("cabana defaults cross the resort cutoff; dinner defaults honor a full 24 hours rather than simply tomorrow", () => {
  assert.equal(
    dates.earliestRequestDate(false, new Date("2026-11-16T18:59:00Z")),
    "2026-11-16",
  );
  assert.equal(
    dates.earliestRequestDate(false, new Date("2026-11-16T19:00:00Z")),
    "2026-11-17",
  );
  assert.equal(
    dates.earliestRequestDate(true, new Date("2026-11-17T02:00:00Z")),
    "2026-11-18",
  );
  assert.equal(
    dates.earliestRequestDate(true, new Date("2026-11-16T23:00:00Z")),
    "2026-11-17",
  );
  assert.deepEqual(
    Array.from(
      catalogue.requestableTimes(
        "2026-11-17",
        true,
        [],
        [],
        Date.parse("2026-11-16T23:00:00Z"),
      ),
    ),
    [1200],
  );
  assert.equal(
    dates.validBookingDate("2026-02-31", "2026-01-01", "2027-01-01"),
    false,
  );
});
test("next-available search skips fully held days and respects all three anchored cabanas", async () => {
  const full = soldOut("2026-11-17");
  const s = server(full.days, full.slots);
  const result = await s.findNextExperienceDate(
    false,
    "2026-11-17",
    "2027-11-16",
    new Date("2026-11-17T02:00:00Z"),
  );
  assert.equal(result.date, "2026-11-18");
  assert.equal(s.calls.length, 2);
  assert.deepEqual(Array.from(s.calls[1].filters.statuses), [
    "requested",
    "confirmed",
    "completed",
  ]);
  const oneFree = server(
    full.days,
    full.slots.filter((row) => !(row.cabana === 3 && row.start_minute === 660)),
  );
  assert.equal(
    (
      await oneFree.findNextExperienceDate(
        false,
        "2026-11-17",
        "2027-11-16",
        new Date("2026-11-17T02:00:00Z"),
      )
    ).date,
    "2026-11-17",
  );
});
test("search crosses bounded calendar batches, ends at the booking horizon, and never converts errors to availability", async () => {
  const days = [],
    slots = [];
  for (let i = 0; i < 31; i++) {
    const full = soldOut(status.addDaysYmd("2026-11-17", i));
    days.push(...full.days);
    slots.push(...full.slots);
  }
  const s = server(days, slots);
  const result = await s.findNextExperienceDate(
    false,
    "2026-11-17",
    "2027-11-16",
    new Date("2026-11-17T02:00:00Z"),
  );
  assert.equal(result.date, "2026-12-18");
  assert.equal(s.calls.length, 4);
  assert.equal(
    await server(days, slots).findNextExperienceDate(
      false,
      "2026-11-17",
      "2026-12-17",
      new Date("2026-11-17T02:00:00Z"),
    ),
    null,
  );
  await assert.rejects(
    server([], [], true).findNextExperienceDate(
      false,
      "2026-11-17",
      "2027-11-16",
    ),
    /Availability could not be loaded/,
  );
  const dinner = server();
  assert.equal(
    (
      await dinner.findNextExperienceDate(
        true,
        "2026-11-17",
        "2027-11-16",
        new Date("2026-11-17T02:00:00Z"),
      )
    ).date,
    "2026-11-18",
  );
  assert.equal(dinner.calls.length, 0);
});
test("a manually selected empty day explains the date and offers the next day without displaying an unusable form", () => {
  const calls = [];
  const { MemberBooking } = load("components/bookings/member-booking.tsx", {
    "react/jsx-runtime": require("react/jsx-runtime"),
    react: {
      useState: (initial) => [initial, () => {}],
      useTransition: () => [false, (callback) => callback()],
    },
    "next/navigation": {
      useRouter: () => ({ replace: (...args) => calls.push(args) }),
    },
    "./booking-form": {
      BookingForm: () => {
        throw Error("Empty dates must not render booking form");
      },
    },
    "@/lib/bookings/catalogue": catalogue,
    "@/lib/format/date": load("lib/format/date.ts"),
  });
  const element = MemberBooking({
    today: "2026-11-16",
    maxDate: "2027-11-16",
    date: "2026-11-16",
    dinner: false,
    days: [],
    occupied: [],
    now: Date.parse("2026-11-16T20:00:00Z"),
  });
  const html = renderToStaticMarkup(element);
  assert.match(html, /No cabana times are available on 16 Nov 2026/);
  assert.match(html, /Find next date/);
  assert.doesNotMatch(html, /<form|Choose a package/);
  const nodes = [];
  function walk(node) {
    if (!node || typeof node !== "object") return;
    nodes.push(node);
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children : [children])
      walk(child);
  }
  walk(element);
  nodes.find((n) => n.type === "button").props.onClick();
  assert.equal(calls[0][0], "/member/experiences?kind=cabana&after=2026-11-16");
});
