const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function action(staff, rpc) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync("app/(staff)/members/[memberId]/extend-access.ts", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
        },
      },
    ).outputText,
    {
      exports,
      Date,
      require(name) {
        if (name === "@/lib/auth/staff")
          return {
            requireStaff: async (roles) => {
              assert.deepEqual(Array.from(roles), ["admin"]);
              if (staff !== "admin") throw Error("forbidden");
              return { admin: { rpc }, user: { id: id(9) } };
            },
          };
        if (name === "next/navigation")
          return {
            redirect: (path) => {
              throw Error(`redirect:${path}`);
            },
          };
        throw Error(name);
      },
    },
  );
  return exports.extendAccessAction;
}
function form(overrides = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    member_id: id(1),
    pass_id: id(2),
    submission_key: id(3),
    expected_end: "2026-11-30",
    new_end: "2026-12-31",
    reason: "Approved courtesy",
    staff_id: id(99),
    ...overrides,
  }))
    data.set(key, value);
  return data;
}
test("extension action requires admin and derives the actor from the authenticated session", async () => {
  let calls = 0;
  const rpc = async (name, args) => {
    calls++;
    assert.equal(name, "extend_access_pass");
    assert.equal(args.p_staff_id, id(9));
    assert.equal(args.p_new_end, "2026-12-31");
    assert.equal(args.p_expected_end, "2026-11-30");
    return { error: null };
  };
  await assert.rejects(action("front_desk", rpc)(form()), /forbidden/);
  assert.equal(calls, 0);
  await assert.rejects(action("admin", rpc)(form()), /redirect:.*extended=1/);
  assert.equal(calls, 1);
});
test("invalid dates, shortened dates, IDs and missing reasons never reach the extension RPC", async () => {
  const run = action("admin", () => {
    assert.fail("Invalid input reached RPC");
  });
  for (const overrides of [
    { new_end: "2026-02-30" },
    { new_end: "2026-11-30" },
    { new_end: "2026-11-29" },
    { reason: "" },
    { pass_id: "bad" },
    { submission_key: "" },
  ])
    await assert.rejects(run(form(overrides)), /redirect:.*err=/);
});
test("stale or failed extensions return an error rather than a success message", async () => {
  await assert.rejects(
    action("admin", async () => ({ error: { message: "Expiry changed" } }))(
      form(),
    ),
    /redirect:.*err=/,
  );
});
