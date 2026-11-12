const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const crypto = require("node:crypto");
const ts = require("typescript");
function load(path, imports, extra = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    }).outputText,
    {
      exports,
      Buffer,
      Date,
      Number,
      Response,
      Request,
      URL,
      console: { error() {} },
      require: (name) => {
        assert.ok(name in imports, name);
        return imports[name];
      },
      ...extra,
    },
  );
  return exports;
}
function webhook({
  rpcError = null,
  env = { FYGARO_HOOK_SECRETS: JSON.stringify({ test: "secret" }) },
} = {}) {
  const calls = [];
  const handler = load(
    "app/api/fygaro/webhook/route.ts",
    {
      crypto: crypto,
      "next/server": { NextResponse: Response },
      "@/lib/supabase/admin": {
        createAdminClient: () => ({
          rpc: async (name, args) => {
            calls.push({ name, args });
            return { error: rpcError };
          },
        }),
      },
    },
    {
      process: {
        env,
      },
    },
  ).POST;
  function request({
    badSignature = false,
    stale = false,
    amount = "25.00",
  } = {}) {
    const body = JSON.stringify({
      transactionId: "txn-one",
      customReference: "00000000-0000-4000-8000-000000000040",
      reference: "provider-reference",
      amount,
      currency: "USD",
      client: { email: "unnecessary@example.com" },
    });
    const time = Math.floor(Date.now() / 1000) - (stale ? 301 : 0);
    const signature = crypto
      .createHmac("sha256", "secret")
      .update(`${time}.${body}`)
      .digest("hex");
    return new Request("https://example.com/api/fygaro/webhook", {
      method: "POST",
      body,
      headers: {
        "fygaro-key-id": "test",
        "fygaro-signature": `t=${time},v1=${badSignature ? "0".repeat(64) : signature}`,
      },
    });
  }
  return { handler, request, calls };
}
test("bad or stale signatures cannot reach payment fulfilment", async () => {
  for (const flags of [{ badSignature: true }, { stale: true }]) {
    const x = webhook();
    assert.equal((await x.handler(x.request(flags))).status, 400);
    assert.equal(x.calls.length, 0);
  }
});
test("valid webhook invokes atomic fulfilment and does not forward private payload fields", async () => {
  const x = webhook();
  assert.equal((await x.handler(x.request())).status, 200);
  assert.equal(x.calls[0].name, "fulfil_access_payment");
  assert.equal(x.calls[0].args.p_amount, 25);
  assert.ok(!JSON.stringify(x.calls).includes("unnecessary@example.com"));
});
test("failed fulfilment remains retryable with non-success HTTP response", async () => {
  const x = webhook({ rpcError: { code: "database-failure" } });
  assert.equal((await x.handler(x.request())).status, 503);
});
test("missing/invalid captured amount is rejected before RPC", async () => {
  const x = webhook();
  assert.equal(
    (await x.handler(x.request({ amount: "not-money" }))).status,
    400,
  );
  assert.equal(x.calls.length, 0);
});
function qr({ role = "front_desk", signedIn = true, active = true } = {}) {
  let privilegedReads = 0;
  const handler = load(
    "app/api/qr/verify/route.ts",
    {
      "next/server": { NextResponse: Response },
      "@/lib/supabase/server": {
        createClient: async () => ({
          auth: {
            getUser: async () => ({
              data: { user: signedIn ? { id: "staff" } : null },
            }),
          },
          from: () => ({
            select() {
              return this;
            },
            eq() {
              return this;
            },
            maybeSingle: async () => ({ data: { role, is_active: active } }),
          }),
        }),
      },
      "@/lib/supabase/admin": {
        createAdminClient: () => {
          privilegedReads++;
          return {
            from: () => ({
              select() {
                return this;
              },
              eq() {
                return this;
              },
              maybeSingle: async () => ({
                data: { id: "member", full_name: "Guest", is_active: true },
              }),
            }),
          };
        },
      },
      "@/lib/qr/token": {
        verifyQrToken: () => ({
          ok: true,
          claims: { mid: "member", exp: 123 },
        }),
      },
      "@/lib/access/server": {
        loadAccess: async () => ({ gym: true, resort: false }),
      },
    },
    { process: { env: { QR_TOKEN_SECRET: "test" } } },
  ).POST;
  return {
    handler,
    get privilegedReads() {
      return privilegedReads;
    },
  };
}
for (const options of [
  { signedIn: false },
  { role: "member" },
  { active: false },
])
  test(`QR rejects unauthorised caller ${JSON.stringify(options)}`, async () => {
    const x = qr(options);
    assert.equal(
      (
        await x.handler(
          new Request("https://example.com", {
            method: "POST",
            body: '{"token":"test"}',
          }),
        )
      ).status,
      options.signedIn === false ? 401 : 403,
    );
    assert.equal(x.privilegedReads, 0);
  });
test("authorised verification returns facility decisions without phone or email", async () => {
  const x = qr();
  const r = await x.handler(
    new Request("https://example.com", {
      method: "POST",
      body: '{"token":"test"}',
    }),
  );
  const body = await r.json();
  assert.equal(body.gym_access, true);
  assert.equal(body.resort_access, false);
  assert.equal(body.member.email, undefined);
  assert.equal(body.member.phone, undefined);
  assert.equal(r.headers.get("cache-control"), "no-store");
});

test("repeat sign-in bootstraps free membership without replacing existing access", async () => {
  const writes = [];
  const db = {
    from(table) {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: async () => ({
          data:
            table === "staff_profiles"
              ? null
              : table === "members"
                ? { id: "existing-member" }
                : null,
          error: null,
        }),
        single: async () => ({ data: { id: "free-plan" }, error: null }),
        upsert: async (payload, options) => {
          writes.push({ table, payload, options });
          return { error: null };
        },
      };
    },
  };
  const handler = load("app/auth/post-login/route.ts", {
    "next/server": {
      NextResponse: { redirect: (url) => Response.redirect(url) },
    },
    "@/lib/supabase/server": {
      createClient: async () => ({
        auth: {
          getUser: async () => ({
            data: {
              user: {
                id: "user",
                email: "guest@example.com",
                email_confirmed_at: "verified",
              },
            },
          }),
        },
      }),
    },
    "@/lib/supabase/admin": { createAdminClient: () => db },
    "@/lib/auth/return-to": { safeReturnTo: () => "/member" },
    "@/lib/membership/status": { jamaicaTodayYmd: () => "2026-11-12" },
  }).GET;
  const response = await handler(
    new Request("https://example.com/auth/post-login"),
  );
  assert.equal(new URL(response.headers.get("location")).pathname, "/member");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].table, "memberships");
  assert.equal(writes[0].options.ignoreDuplicates, true);
  assert.equal(writes[0].options.onConflict, "member_id");
});

test("existing production webhook variable names remain supported", async () => {
  const x = webhook({
    env: { FYGARO_WEBHOOK_KEY_ID: "test", FYGARO_WEBHOOK_SECRET: "secret" },
  });
  assert.equal((await x.handler(x.request())).status, 200);
  assert.equal(x.calls.length, 1);
});
test("a configured invalid rotation map fails closed rather than changing keys", async () => {
  const x = webhook({
    env: {
      FYGARO_HOOK_SECRETS: "invalid",
      FYGARO_WEBHOOK_KEY_ID: "test",
      FYGARO_WEBHOOK_SECRET: "secret",
    },
  });
  assert.equal((await x.handler(x.request())).status, 400);
  assert.equal(x.calls.length, 0);
});
