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
const rules = load("lib/bookings/catalogue.ts");
test("availability offers two viable sessions and hides held inventory across all three cabanas", () => {
  assert.deepEqual(
    Array.from(rules.cabanaStarts(1, [], [])),
    [420, 450, 480, 510, 540, 570, 600, 660, 690, 720, 750, 780, 810, 840],
  );
  assert.deepEqual(
    Array.from(
      rules.cabanaStarts(
        1,
        [{ cabana: 1, first_start: 540 }],
        [{ cabana: 1, start_minute: 540 }],
      ),
    ),
    [780],
  );
  assert.equal(
    rules.cabanaStarts(
      2,
      [{ cabana: 1, first_start: 540 }],
      [{ cabana: 1, start_minute: 540 }],
    ).length,
    14,
  );
  assert.equal(
    rules.futureSlot(
      "2026-11-15",
      1080,
      24,
      Date.parse("2026-11-14T23:01:00Z"),
    ),
    false,
  );
  assert.equal(
    rules.productTotal({ price: 140, tax_rate: 0.1, service_rate: 0.1 }),
    168,
  );
});
test("guest booking cards show status, menu and dietary notes without exposing desk payment references", () => {
  const { BookingCard } = load("components/bookings/booking-card.tsx", {
    "react/jsx-runtime": require("react/jsx-runtime"),
    "@/lib/bookings/catalogue": rules,
    "@/lib/format/date": { membershipDate: (date) => date },
  });
  const b = {
    id: "sample-id",
    booking_date: "2026-11-15",
    start_minute: 1080,
    end_minute: 1200,
    cabana: null,
    product_snapshot: { name: "Starlight Dinner for two" },
    total: 168,
    currency: "USD",
    status: "requested",
    paid_at: null,
    guest_name: "Guest",
    email: "private@example.com",
    phone: "8765550100",
    payment_reference: "INTERNAL-RECEIPT",
    menu: [
      {
        appetizer: "Fish Cake",
        salad: "Tossed Salad",
        main: "Cajun Shrimp",
        sides: ["Vegetable Rice", "Herb Mash Potato"],
        dessert: "Tropical Fruit Salad",
      },
    ],
    dietary_notes: "Nut allergy",
  };
  const guest = renderToStaticMarkup(BookingCard({ booking: b }));
  assert.match(guest, /Awaiting confirmation/);
  assert.match(guest, /Nut allergy/);
  assert.match(guest, /Cajun Shrimp/);
  assert.doesNotMatch(guest, /private@example|8765550100|INTERNAL-RECEIPT/);
  const staff = renderToStaticMarkup(BookingCard({ booking: b, staff: true }));
  assert.match(staff, /private@example.com/);
  assert.match(staff, /INTERNAL-RECEIPT/);
});
test("guest booking actions derive identity from the session and return errors without losing the booking form", async () => {
  let call;
  const actions = load("app/(member)/member/experiences/actions.ts", {
    "@/lib/access/server": {
      requireMember: async () => ({
        user: { id: "signed-in-user" },
        member: { id: "own-member" },
        admin: {
          rpc: async (name, args) => {
            call = { name, args };
            return { error: { message: "Slot just booked; choose another" } };
          },
        },
      }),
    },
    "@/lib/bookings/server": {
      bookingPayload: () => ({ product: "cabana_classic" }),
      bookingError: (v) => v,
    },
    "next/navigation": {
      redirect: () => {
        throw new Error("unexpected redirect");
      },
    },
    "next/cache": { revalidatePath: () => {} },
  });
  const form = new FormData();
  form.set("member_id", "other-member");
  form.set("actor", "other-user");
  form.set("submission_key", "request-1");
  const result = await actions.requestExperience(form);
  assert.equal(result.error, "Slot just booked; choose another");
  assert.equal(call.args.p_actor, "signed-in-user");
  assert.equal(call.args.p_member, "own-member");
  assert.equal(call.args.p_source, "member");
});
