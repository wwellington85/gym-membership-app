const { test } = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("node:fs");
const vm = require("node:vm");
function load(path, imports) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    {
      exports,
      Date,
      Intl,
      URL,
      require(n) {
        assert.ok(n in imports, n);
        return imports[n];
      },
    },
  );
  return exports;
}
const member = "00000000-0000-4000-8000-000000000001",
  gift = "00000000-0000-4000-8000-000000000002";
const status = load("lib/membership/status.ts", {}),
  gifts = load("lib/rewards/gifts.ts", { "@/lib/membership/status": status });
function env({ user = true, seen = true, active = true, error = false } = {}) {
  const filters = [],
    calls = [];
  return {
    filters,
    calls,
    imports: {
      "next/server": {
        NextResponse: { json: (body, options) => ({ body, ...options }) },
      },
      "@/lib/supabase/server": {
        createClient: async () => ({
          auth: {
            getUser: async () => ({
              data: { user: user ? { id: "actual-user" } : null },
            }),
          },
        }),
      },
      "@/lib/supabase/admin": {
        createAdminClient: () => ({
          rpc: async (name, args) => {
            calls.push({ name, args });
            return { data: seen, error: null };
          },
          from(table) {
            return {
              select() {
                return this;
              },
              eq(k, v) {
                filters.push([table, k, v]);
                return this;
              },
              is(k, v) {
                filters.push([table, k, v]);
                return this;
              },
              gte() {
                return this;
              },
              order() {
                return this;
              },
              maybeSingle: async () => ({
                data: { id: member, is_active: active },
                error: error ? { message: "No DB" } : null,
              }),
              limit: async () => ({
                data: [
                  {
                    id: gift,
                    title: "A treat",
                    icon: "drink",
                    valid_until: "2099-01-01",
                    status: "available",
                    issue_reason: "PRIVATE",
                  },
                  {
                    id: "expired",
                    title: "Old",
                    valid_until: "2000-01-01",
                    status: "available",
                  },
                ],
                error: null,
              }),
            };
          },
        }),
      },
      "@/lib/rewards/gifts": gifts,
      "@/lib/membership/status": status,
    },
  };
}
test("notifications are owned, unread, active and unexpired; staff notes never leave the API", async () => {
  const e = env();
  const res = await load(
    "app/api/rewards/notifications/route.ts",
    e.imports,
  ).GET();
  assert.equal(res.status, 200);
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.items[0].icon, "drink");
  assert.equal("issue_reason" in res.body.items[0], false);
  assert.match(res.headers["Cache-Control"], /private, no-store/);
  assert.ok(
    e.filters.some(
      ([t, k, v]) => t === "members" && k === "user_id" && v === "actual-user",
    ),
  );
  assert.ok(
    e.filters.some(
      ([t, k, v]) => t === "reward_gifts" && k === "member_id" && v === member,
    ),
  );
  assert.ok(
    e.filters.some(
      ([t, k, v]) => t === "reward_gifts" && k === "seen_at" && v === null,
    ),
  );
  assert.equal(
    (
      await load(
        "app/api/rewards/notifications/route.ts",
        env({ user: false }).imports,
      ).GET()
    ).status,
    401,
  );
  assert.equal(
    (
      await load(
        "app/api/rewards/notifications/route.ts",
        env({ active: false }).imports,
      ).GET()
    ).body.items.length,
    0,
  );
  assert.equal(
    (
      await load(
        "app/api/rewards/notifications/route.ts",
        env({ error: true }).imports,
      ).GET()
    ).status,
    503,
  );
});
test("read receipts derive ownership from the session and reject cross-origin or other-account requests", async () => {
  const request = (origin = "https://club.tbr.travel") => ({
    url: "https://club.tbr.travel/api/rewards/seen",
    headers: new Headers({
      origin: origin,
      "content-type": "application/json",
    }),
    json: async () => ({ giftId: gift, memberId: "attacker-controlled" }),
  });
  const e = env();
  const POST = load("app/api/rewards/seen/route.ts", e.imports).POST;
  assert.equal((await POST(request("https://attacker.example"))).status, 403);
  assert.equal(e.calls.length, 0);
  assert.equal((await POST(request())).status, 200);
  assert.equal(e.calls[0].args.p_member_id, member);
  assert.equal(e.calls[0].args.p_gift_id, gift);
  assert.equal(
    (
      await load(
        "app/api/rewards/seen/route.ts",
        env({ seen: false }).imports,
      ).POST(request())
    ).status,
    404,
  );
  assert.equal(
    (
      await load(
        "app/api/rewards/seen/route.ts",
        env({ user: false }).imports,
      ).POST(request())
    ).status,
    401,
  );
});
test("reward permission checks fail closed and administrators retain fixed full access", async () => {
  const permissions = load("lib/rewards/permissions.ts", {
    "@/lib/auth/staff": {},
    "next/navigation": {},
  });
  assert.equal(
    (await permissions.rewardPermissions({}, "admin")).can_issue,
    true,
  );
  assert.equal(
    (await permissions.rewardPermissions({}, "security")).can_issue,
    false,
  );
  await assert.rejects(
    permissions.rewardPermissions(
      {
        from: () => ({
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: null, error: {} }),
        }),
      },
      "supervisor",
    ),
    /could not be verified/,
  );
});
