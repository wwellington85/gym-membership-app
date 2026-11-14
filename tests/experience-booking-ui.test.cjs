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
test("guest form pools cabana availability and keeps physical cabana selection on staff forms", () => {
  const { BookingForm } = load("components/bookings/booking-form.tsx", {
    "react/jsx-runtime": require("react/jsx-runtime"),
    react: {
      useState: (initial) => [initial, () => {}],
      useActionState: () => [{ error: "", values: {} }, () => {}],
    },
    "react-dom": { useFormStatus: () => ({ pending: false }) },
    "@/lib/bookings/catalogue": rules,
  });
  const props = {
    products: [
      {
        code: "cabana_classic",
        name: "Cabana Classic",
        price: 80,
        tax_rate: 0,
        service_rate: 0,
        inclusions: [],
      },
    ],
    date: "2026-11-15",
    days: [{ cabana: 1, first_start: 540 }],
    occupied: [
      { cabana: 1, start_minute: 540 },
      { cabana: 1, start_minute: 780 },
    ],
    submissionKey: "request",
    action: async () => {},
    now: Date.parse("2026-11-14T12:00:00Z"),
  };
  const guest = renderToStaticMarkup(BookingForm(props));
  assert.doesNotMatch(guest, /name="cabana"|Cabana [123]|Try another cabana/);
  assert.match(guest, /value="540"/);
  assert.match(guest, /id="booking-times"/);
  const staff = renderToStaticMarkup(BookingForm({ ...props, staff: true }));
  assert.match(staff, /name="cabana"/);
  assert.match(staff, /Cabana 1/);
  assert.doesNotMatch(staff, /value="540"/);
});
test("date changes navigate automatically without scrolling; Show times is only a section link", () => {
  const calls = [];
  const { MemberBooking } = load("components/bookings/member-booking.tsx", {
    "react/jsx-runtime": require("react/jsx-runtime"),
    react: { useTransition: () => [false, (callback) => callback()] },
    "next/navigation": {
      useRouter: () => ({ replace: (...args) => calls.push(args) }),
    },
    "./booking-form": { BookingForm: () => null },
  });
  const element = MemberBooking({
    today: "2026-11-14",
    maxDate: "2027-11-14",
    dinner: false,
    date: "2026-11-15",
  });
  const elements = [];
  function walk(node) {
    if (!node || typeof node !== "object") return;
    elements.push(node);
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children : [children])
      walk(child);
  }
  walk(element);
  const input = elements.find((e) => e.type === "input");
  input.props.onChange({
    currentTarget: { value: "2026-11-16", validity: { valid: true } },
  });
  assert.equal(calls[0][0], "/member/experiences?kind=cabana&date=2026-11-16");
  assert.equal(calls[0][1].scroll, false);
  const jump = elements.find((e) => e.type === "a");
  assert.equal(jump.props.href, "#booking-times");
  assert.equal(jump.props.onClick, undefined);
  input.props.onChange({
    currentTarget: { value: "", validity: { valid: false } },
  });
  assert.equal(calls.length, 1);
});
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
  assert.equal(call.name, "request_member_experience");
  assert.equal(call.args.p_source, undefined);
});
