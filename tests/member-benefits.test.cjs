const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
function load(path, imports = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      Date,
      Intl,
      require(name) {
        assert.ok(name in imports, name);
        return imports[name];
      },
    },
  );
  return exports;
}
const status = load("lib/membership/status.ts");
const rules = load("lib/access/rules.ts", {
  "@/lib/membership/status": status,
});
const benefits = load("lib/access/benefits.ts", { "./rules": rules });
const free = {
  id: "free",
  code: "rewards_free",
  discount_food: 0.1,
  discount_spa: 0.1,
  discount_giftshop: 0.1,
  discount_watersports: 0.1,
};
const pass = {
  id: "monthly",
  status: "active",
  start_date: "2026-11-01",
  paid_through_date: "2026-11-30",
  plan_snapshot: {
    id: "monthly",
    code: "club_monthly_95",
    name: "Club Monthly",
    grants_access: true,
    access_scope: "resort",
    duration_days: 30,
    discount_food: 0.2,
    discount_spa: 0.15,
    discount_giftshop: 0.15,
    discount_watersports: 0.15,
  },
};
const now = new Date("2026-11-12T20:00:00Z");
const rates = (passes) =>
  Array.from(
    benefits.effectiveBenefits(free, passes, true, now),
    (row) => row.percent,
  );
test("monthly benefits replace base rates per outlet without stacking", () => {
  assert.deepEqual(rates([pass]), [20, 15, 15, 15]);
  assert.deepEqual(
    rates([{ ...pass, payment_method: "complimentary" }]),
    [20, 15, 15, 15],
  );
  assert.deepEqual(
    rates([
      { ...pass, plan_snapshot: { ...pass.plan_snapshot, discount_spa: 0.05 } },
    ]),
    [20, 10, 15, 15],
  );
});
test("ended, future and revoked passes do not advertise enhanced benefits", () => {
  for (const p of [
    { ...pass, paid_through_date: "2026-11-11" },
    { ...pass, start_date: "2026-11-13" },
    { ...pass, status: "revoked" },
  ])
    assert.deepEqual(rates([p]), [10, 10, 10, 10]);
  assert.ok(
    benefits
      .effectiveBenefits(free, [pass], false, now)
      .every((row) => row.percent === 0),
  );
});
test("enhanced rates stop at the Jamaica closing time", () => {
  const daily = {
    ...pass,
    start_date: "2026-11-12",
    paid_through_date: "2026-11-12",
    plan_snapshot: { ...pass.plan_snapshot, duration_days: 1 },
  };
  assert.equal(
    benefits.effectiveBenefits(
      free,
      [daily],
      true,
      new Date("2026-11-13T02:59:00Z"),
    )[0].percent,
    20,
  );
  assert.equal(
    benefits.effectiveBenefits(
      free,
      [daily],
      true,
      new Date("2026-11-13T03:00:00Z"),
    )[0].percent,
    10,
  );
});
test("Home renders the current pass benefits instead of the free catalogue rates", async () => {
  const React = require("react");
  const activePass = { ...pass, paid_through_date: "2099-12-31" };
  const Home = load("app/(member)/member/page.tsx", {
    "react/jsx-runtime": require("react/jsx-runtime"),
    "next/link": {
      default: ({ children, ...props }) =>
        React.createElement("a", props, children),
    },
    "@/lib/access/server": {
      requireMember: async () => ({
        member: { id: "self", full_name: "Example Member", is_active: true },
      }),
      loadAccess: async () => ({
        passes: [activePass],
        current: [activePass],
        best: activePass,
      }),
      loadCatalogue: async () => [free],
    },
    "@/lib/access/benefits": benefits,
    "@/lib/access/rules": rules,
    "@/lib/format/name": { firstName: () => "Example" },
  }).default;
  const html = require("react-dom/server").renderToStaticMarkup(await Home());
  assert.match(html, /20% off/);
  assert.match(html, /15% off/);
  assert.doesNotMatch(html, /10% off/);
});
