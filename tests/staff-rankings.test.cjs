const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
function page(admin, roles) {
  const exports = {};
  const imports = {
    "react/jsx-runtime": require("react/jsx-runtime"),
    "next/link": {
      default: ({ children, ...props }) =>
        React.createElement("a", props, children),
    },
    "@/lib/auth/staff": {
      requireStaff: async (allowed) => {
        roles.push(allowed);
        return { admin };
      },
    },
  };
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync("app/(staff)/checkins/rankings/page.tsx", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          jsx: ts.JsxEmit.ReactJSX,
        },
      },
    ).outputText,
    { exports, Date, Map, require: (name) => imports[name] },
  );
  return exports.default;
}
test("management rankings preserve database rank across pages and restrict access to management roles", async () => {
  const roles = [],
    calls = [];
  const rows = Array.from({ length: 26 }, (_, i) => ({
    member_id: `member-${i}`,
    rank: 26 + i,
    checkins: 40 - i,
    last_checkin_at: "2026-11-13T00:00:00Z",
  }));
  const admin = {
    rpc: (name, args) => {
      calls.push([name, args]);
      return {
        order: (key) => {
          assert.equal(key, "rank");
          return {
            range: async (from, to) => {
              assert.equal(from, 25);
              assert.equal(to, 50);
              return { data: rows, error: null };
            },
          };
        },
      };
    },
    from: () => ({
      select: () => ({
        in: async (key, ids) => {
          assert.equal(ids.length, 25);
          return {
            data: ids.map((id) => ({
              id,
              full_name: `Guest ${id}`,
              is_active: true,
            })),
            error: null,
          };
        },
      }),
    }),
  };
  const html = require("react-dom/server").renderToStaticMarkup(
    await page(
      admin,
      roles,
    )({ searchParams: Promise.resolve({ period: "month", page: "1" }) }),
  );
  assert.equal(
    JSON.stringify(roles),
    JSON.stringify([["admin", "front_desk"]]),
  );
  assert.equal(calls[0][0], "member_leaderboard_rankings");
  assert.equal(calls[0][1].p_period, "month");
  assert.match(html, /#26/);
  assert.match(html, /Guest member-0/);
  assert.match(html, /href="\/members\/member-0"/);
  assert.match(html, /page=2/);
  assert.doesNotMatch(html, /Guest member-25/);
});
test("rank service failure is an error rather than an empty or zero ranking", async () => {
  const admin = {
    rpc: () => ({
      order: () => ({
        range: async () => ({ data: null, error: { message: "offline" } }),
      }),
    }),
  };
  const html = require("react-dom/server").renderToStaticMarkup(
    await page(
      admin,
      [],
    )({ searchParams: Promise.resolve({ period: "invalid" }) }),
  );
  assert.match(html, /role="alert"/);
  assert.match(html, /could not be loaded/);
  assert.doesNotMatch(html, /No recorded visits/);
});
