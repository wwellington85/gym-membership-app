const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
function load(path, imports = {}, env = {}) {
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
      URL,
      Buffer,
      process: { env },
      require(n) {
        assert.ok(n in imports, n);
        return imports[n];
      },
    },
  );
  return exports;
}
const subscriptionRules = load("lib/push/subscription.ts");
const member = "00000000-0000-4000-8000-000000000001",
  device = "00000000-0000-4000-8000-000000000002";
const endpoint = "https://web.push.apple.com/endpoint";
const sub = {
  endpoint,
  memberId: "forged",
  keys: {
    p256dh: Buffer.alloc(65, 4).toString("base64url"),
    auth: Buffer.alloc(16, 1).toString("base64url"),
  },
};
function api({ signedIn = true, active = true } = {}) {
  const state = { filters: [], calls: [], cookies: [] };
  const routes = load(
    "app/api/push/route.ts",
    {
      "next/server": {
        NextResponse: {
          json: (body, options) => ({
            body,
            ...options,
            cookies: { set: (...args) => state.cookies.push(args) },
          }),
        },
      },
      "@/lib/supabase/server": {
        createClient: async () => ({
          auth: {
            getUser: async () => ({
              data: { user: signedIn ? { id: "actual-user" } : null },
            }),
          },
        }),
      },
      "@/lib/supabase/admin": {
        createAdminClient: () => ({
          rpc: async (name, args) => {
            state.calls.push([name, args]);
            return { data: device, error: null };
          },
          from(table) {
            const q = {
              select() {
                return q;
              },
              delete() {
                state.calls.push(["delete"]);
                return q;
              },
              eq(k, v) {
                state.filters.push([table, k, v]);
                return q;
              },
              maybeSingle: async () => ({
                data:
                  table === "members"
                    ? { id: member, is_active: active }
                    : { id: device },
                error: null,
              }),
              then(resolve) {
                resolve({ error: null });
              },
            };
            return q;
          },
        }),
      },
      "@/lib/push/subscription": subscriptionRules,
    },
    {
      WEB_PUSH_PUBLIC_KEY: "public-key",
      WEB_PUSH_PRIVATE_KEY: "private-key-never-return",
      WEB_PUSH_SUBJECT: "mailto:test@example.com",
    },
  );
  return { routes, state };
}
function req({
  origin = "https://club.tbr.travel",
  body = sub,
  headers = {},
} = {}) {
  return {
    url: "https://club.tbr.travel/api/push",
    headers: new Headers({
      origin: origin,
      "content-type": "application/json",
      ...headers,
    }),
    json: async () => body,
  };
}
test("push registration and disabling derive the member from auth and require same-origin requests", async () => {
  const { routes, state } = api();
  assert.equal(
    (await routes.POST(req({ origin: "https://attacker.example" }))).status,
    403,
  );
  assert.equal(state.calls.length, 0);
  const response = await routes.POST(req());
  assert.equal(response.status, 200);
  assert.equal(state.calls[0][1].p_member_id, member);
  assert.equal(state.cookies[0][0], "club_push_device");
  assert.equal(state.cookies[0][2].httpOnly, true);
  await routes.DELETE(req({ body: { endpoint, memberId: "forged" } }));
  assert.ok(
    state.filters.some(
      ([t, k, v]) =>
        t === "push_subscriptions" && k === "member_id" && v === member,
    ),
  );
  assert.equal(
    (
      await routes.POST(
        req({ body: { ...sub, endpoint: "https://127.0.0.1/internal" } }),
      )
    ).status,
    400,
  );
  assert.equal((await routes.DELETE(req({ body: null }))).status, 400);
  assert.equal((await api({ signedIn: false }).routes.POST(req())).status, 401);
  assert.equal((await api({ active: false }).routes.POST(req())).status, 403);
});
test("push settings expose only the public key and owned-device status with private cache headers", async () => {
  const { routes, state } = api();
  const res = await routes.GET(
    req({ headers: { "x-push-endpoint": endpoint } }),
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.publicKey, "public-key");
  assert.equal(res.body.registered, true);
  assert.doesNotMatch(JSON.stringify(res.body), /private-key-never-return/);
  assert.match(res.headers["Cache-Control"], /private, no-store/);
  assert.ok(
    state.filters.some(
      ([t, k, v]) => t === "members" && k === "user_id" && v === "actual-user",
    ),
  );
  assert.ok(
    state.filters.some(
      ([t, k, v]) =>
        t === "push_subscriptions" && k === "member_id" && v === member,
    ),
  );
  assert.equal((await api({ signedIn: false }).routes.GET(req())).status, 401);
});
test("service worker always shows generic push content and opens only the member rewards URL", async () => {
  const handlers = {},
    shown = [],
    opened = [],
    pending = [];
  const self = {
    location: { origin: "https://club.tbr.travel" },
    addEventListener: (name, handler) => (handlers[name] = handler),
    registration: { showNotification: async (...args) => shown.push(args) },
    clients: {
      matchAll: async () => [],
      openWindow: async (url) => opened.push(url),
    },
  };
  vm.runInNewContext(fs.readFileSync("public/sw.js", "utf8"), { self, URL });
  handlers.push({
    data: {
      json: () => ({
        title: "PRIVATE TITLE",
        body: "PRIVATE DETAILS",
        url: "https://attacker.example",
      }),
    },
    waitUntil: (p) => pending.push(p),
  });
  await Promise.all(pending);
  assert.equal(shown.length, 1);
  assert.doesNotMatch(JSON.stringify(shown), /PRIVATE|attacker/);
  handlers.notificationclick({
    notification: { close() {}, data: { url: "https://attacker.example" } },
    waitUntil: (p) => pending.push(p),
  });
  await Promise.all(pending);
  assert.equal(
    opened[0],
    "https://club.tbr.travel/member/benefits#member-rewards",
  );
});
