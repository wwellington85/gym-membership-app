const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
function load(path, imports = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  runInNewContext(source, {
    exports,
    Date,
    Intl,
    require: (name) => {
      assert.ok(name in imports, name);
      return imports[name];
    },
  });
  return exports;
}
const status = load("lib/membership/status.ts");
const rules = load("lib/access/rules.ts", {
  "@/lib/membership/status": status,
});
const now = new Date("2026-11-12T15:00:00Z");
const pass = {
  id: "pass",
  plan_id: "monthly",
  status: "active",
  start_date: "2026-11-01",
  paid_through_date: "2026-11-30",
  plan_snapshot: { duration_days: 30 },
};
test("one calendar day ends the same day; free expiry cannot extend a first purchase", () => {
  const p = rules.purchasePeriod({
    start: "2026-11-12",
    duration: 1,
    renew: true,
    planId: "gym",
    current: { ...pass, plan_id: "free", paid_through_date: "2036-11-09" },
    now,
  });
  assert.equal(p.start, "2026-11-12");
  assert.equal(p.end, "2026-11-12");
});
test("explicit same-product renewal keeps all remaining service", () => {
  const p = rules.purchasePeriod({
    start: "2026-11-12",
    duration: 30,
    renew: true,
    current: pass,
    planId: "monthly",
    now,
  });
  assert.equal(p.start, "2026-12-01");
  assert.equal(p.end, "2026-12-30");
});
test("new purchase keeps chosen date, rather than implicitly renewing", () => {
  const p = rules.purchasePeriod({
    start: "2026-11-15",
    duration: 7,
    current: pass,
    planId: "monthly",
    now,
  });
  assert.equal(p.start, "2026-11-15");
  assert.equal(p.end, "2026-11-21");
});
test("expired final-day pass does not push a renewal to tomorrow after 10 pm", () => {
  const p = rules.purchasePeriod({
    start: "2026-11-12",
    duration: 1,
    renew: true,
    current: { ...pass, paid_through_date: "2026-11-12" },
    planId: "monthly",
    now: new Date("2026-11-13T03:30:00Z"),
  });
  assert.equal(p.start, "2026-11-12");
});
for (const start of ["2026-02-31", "2026-11-11", "", "not a date"])
  test(`rejects invalid/past start ${start}`, () =>
    assert.throws(() =>
      rules.purchasePeriod({ start, duration: 1, planId: "gym", now }),
    ));
test("gym-only product never acquires pool/resort inclusions", () => {
  assert.equal(
    rules.accessScope({ code: "gym_day", grants_access: true }),
    "gym",
  );
  assert.equal(
    rules.facilities({ code: "gym_day", grants_access: true }).join(","),
    "Gym",
  );
  assert.ok(
    rules
      .facilities({
        code: "club_day",
        grants_access: true,
        access_scope: "resort",
      })
      .includes("Pool"),
  );
  assert.equal(
    rules.facilities({ code: "rewards_free", grants_access: false }).length,
    0,
  );
});
test("activity awards honour zero and reject nonfinite input", () => {
  assert.equal(rules.pointsPerVisit(0), 0);
  assert.equal(rules.pointsPerVisit(undefined), 1);
  assert.equal(rules.pointsPerVisit(NaN), 1);
});
test("full member number round-trips without a truncated identity", () => {
  const id = "11111111-2222-4333-8444-555555555555";
  assert.equal(rules.memberIdFromNumber(rules.memberNumber(id)), id);
  assert.equal(rules.memberIdFromNumber("TC-1234"), null);
});
test("revoked and future passes are never valid now", () => {
  assert.equal(rules.passIsActive({ ...pass, status: "revoked" }, now), false);
  assert.equal(
    rules.passIsActive({ ...pass, start_date: "2026-11-15" }, now),
    false,
  );
  assert.equal(rules.passIsActive(pass, now), true);
});
const returnTo = load("lib/auth/return-to.ts");
test("return destinations retain list filters and password recovery without admitting external URLs", () => {
  assert.equal(returnTo.safeReturnTo("/members?q=guest"), "/members?q=guest");
  assert.equal(
    returnTo.safeReturnTo("/auth/update-password?returnTo=/member"),
    "/auth/update-password?returnTo=/member",
  );
  assert.equal(returnTo.safeReturnTo("//other.example/member"), "");
  assert.equal(returnTo.safeReturnTo("/\\other.example/member"), "");
  assert.equal(returnTo.safeReturnTo("https://other.example/member"), "");
});
