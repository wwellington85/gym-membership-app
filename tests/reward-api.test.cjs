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
      process: { env: { QR_TOKEN_SECRET: "test-only" } },
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
const status = load("lib/membership/status.ts", {});
const gifts = load("lib/rewards/gifts.ts", {
  "@/lib/membership/status": status,
});
function route({
  signedIn = true,
  active = true,
  found = true,
  expired = false,
  dbError = false,
} = {}) {
  const filters = [];
  const GET = load("app/api/rewards/qr/route.ts", {
    "next/server": {
      NextResponse: { json: (body, init) => ({ body, ...init }) },
    },
    "@/lib/supabase/server": {
      createClient: async () => ({
        auth: {
          getUser: async () => ({
            data: { user: signedIn ? { id: "auth-user" } : null },
          }),
        },
      }),
    },
    "@/lib/supabase/admin": {
      createAdminClient: () => ({
        from(table) {
          return {
            select() {
              return this;
            },
            eq(k, v) {
              filters.push([table, k, v]);
              return this;
            },
            maybeSingle: async () => ({
              data:
                table === "members"
                  ? { id: member, is_active: active }
                  : found
                    ? {
                        id: gift,
                        status: "available",
                        valid_until: expired ? "2000-01-01" : "2099-01-01",
                      }
                    : null,
              error: dbError ? { message: "error" } : null,
            }),
          };
        },
      }),
    },
    "@/lib/rewards/gifts": gifts,
    "@/lib/rewards/token": {
      signRewardToken: (mid, rid) => {
        assert.equal(mid, member);
        assert.equal(rid, gift);
        return { token: "signed-specific-gift", exp: 99 };
      },
    },
  }).GET;
  return { GET, filters };
}
test("reward QR endpoint requires sign-in and active membership, filters ownership and never caches tokens", async () => {
  const request = {
    url: `https://club.tbr.travel/api/rewards/qr?gift=${gift}`,
  };
  for (const [config, expected] of [
    [{ signedIn: false }, 401],
    [{ active: false }, 403],
    [{ found: false }, 410],
    [{ expired: true }, 410],
    [{ dbError: true }, 503],
  ])
    assert.equal((await route(config).GET(request)).status, expected);
  const { GET, filters } = route();
  const response = await GET(request);
  assert.equal(response.status, 200);
  assert.match(response.headers["Cache-Control"], /private, no-store/);
  assert.equal(response.body.token, "signed-specific-gift");
  assert.ok(
    filters.some(
      ([t, k, v]) => t === "members" && k === "user_id" && v === "auth-user",
    ),
  );
  assert.ok(
    filters.some(
      ([t, k, v]) => t === "reward_gifts" && k === "member_id" && v === member,
    ),
  );
  assert.ok(
    filters.some(
      ([t, k, v]) => t === "reward_gifts" && k === "id" && v === gift,
    ),
  );
});
test("gift status enforces expiry while preserving redeemed and revoked history", () => {
  assert.equal(
    gifts.giftStatus(
      { status: "available", valid_until: "2026-11-14" },
      new Date("2026-11-15T02:59:00Z"),
    ),
    "available",
  );
  assert.equal(
    gifts.giftStatus(
      { status: "available", valid_until: "2026-11-14" },
      new Date("2026-11-15T03:00:00Z"),
    ),
    "expired",
  );
  assert.equal(
    gifts.giftStatus({ status: "redeemed", valid_until: "2000-01-01" }),
    "redeemed",
  );
  assert.equal(
    gifts.giftStatus({ status: "revoked", valid_until: "2099-01-01" }),
    "revoked",
  );
});
