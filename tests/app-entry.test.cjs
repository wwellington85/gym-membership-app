const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const render = require("react-dom/server").renderToStaticMarkup;
function load(file, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      Date,
      ...globals,
      require: (name) => {
        assert.ok(name in imports, name);
        return imports[name];
      },
    },
  );
  return exports;
}
function entry({
  user = { id: "self" },
  staff = null,
  member = { id: "member" },
  staffError = null,
} = {}) {
  const reads = [];
  let signouts = 0;
  const admin = {
    from: (table) => {
      reads.push(table);
      return {
        select: () => ({
          eq: (key, value) => {
            assert.equal(key, "user_id");
            assert.equal(value, "self");
            return {
              maybeSingle: async () => ({
                data: table === "staff_profiles" ? staff : member,
                error: table === "staff_profiles" ? staffError : null,
              }),
            };
          },
        }),
      };
    },
  };
  const GET = load("app/api/app-entry/route.ts", {
    "next/server": {
      NextResponse: { json: (data, options) => ({ data, ...options }) },
    },
    "@/lib/supabase/server": {
      createClient: async () => ({
        auth: {
          getUser: async () => ({ data: { user } }),
          signOut: async () => {
            signouts++;
          },
        },
      }),
    },
    "@/lib/supabase/admin": { createAdminClient: () => admin },
  }).GET;
  return { GET, reads, signouts: () => signouts };
}
test("app launch resolves guest and staff destinations without membership writes or cached identity responses", async () => {
  for (const [staff, destination] of [
    [null, "/member"],
    [{ role: "admin", is_active: true }, "/dashboard"],
    [{ role: "front_desk", is_active: true }, "/dashboard"],
    [{ role: "supervisor", is_active: true }, "/dashboard"],
    [{ role: "security", is_active: true }, "/checkins/scan"],
  ]) {
    const f = entry({ staff });
    const r = await f.GET();
    assert.equal(r.data.destination, destination);
    assert.equal(r.headers["Cache-Control"], "private, no-store");
    assert.ok(f.reads.every((t) => ["staff_profiles", "members"].includes(t)));
  }
});
test("launch requires sign-in and rejects inactive staff and account service errors", async () => {
  const anon = entry({ user: null });
  assert.equal((await anon.GET()).data.destination, "/auth/login");
  assert.equal(anon.reads.length, 0);
  const inactive = entry({ staff: { role: "security", is_active: false } });
  assert.equal((await inactive.GET()).data.destination, "/auth/login");
  assert.equal(inactive.signouts(), 1);
  assert.equal(
    (await entry({ staffError: { message: "offline" } }).GET()).status,
    503,
  );
  assert.equal(
    (await entry({ member: null }).GET()).data.destination,
    "/auth/post-login",
  );
});
const link = {
  default: ({ children, ...props }) =>
    React.createElement("a", props, children),
};
async function dashboard(role, error = false) {
  const Page = load("app/(staff)/dashboard/page.tsx", {
    "react/jsx-runtime": require("react/jsx-runtime"),
    "next/link": link,
    "lucide-react": require("lucide-react"),
    "next/navigation": {
      redirect: (location) => {
        throw Object.assign(new Error("redirect"), { location });
      },
    },
    "@/lib/auth/staff": {
      requireStaff: async () => ({
        staff: { role },
        admin: {
          rpc: async () => ({
            data: { pending_requests: 2, pending_payments: 74 },
            error: error ? { message: "offline" } : null,
          }),
        },
      }),
    },
  }).default;
  return render(await Page());
}
test("staff landing prioritizes service and actionable queues over programme statistics", async () => {
  const html = await dashboard("front_desk");
  assert.match(html, /Member service/);
  assert.match(html, /name="q"/);
  assert.match(html, /action="\/members"/);
  assert.ok(
    html.indexOf("Check in / verify member") < html.indexOf("Needs attention"),
  );
  assert.match(html, /<details[^>]*><summary[^>]*>Programme activity/);
  assert.match(html, /Pending checkout attempts/);
  assert.doesNotMatch(html, /<details[^>]*open/);
  assert.match(await dashboard("admin"), /Management/);
  await assert.rejects(
    dashboard("security"),
    (e) => e.location === "/checkins/scan",
  );
});
test("staff summary failure leaves service actions available and never shows false zeros", async () => {
  const html = await dashboard("front_desk", true);
  assert.match(html, /role="alert"/);
  assert.match(html, /Check in \/ verify member/);
  assert.match(html, /—/);
  assert.doesNotMatch(html, />74</);
});
function clientEntry({
  destination = "/member",
  installedOnly = false,
  standalone = true,
  deferred,
} = {}) {
  const effects = [],
    states = [],
    routes = [],
    requests = [];
  let stateIndex = 0;
  const router = { replace: (path) => routes.push(path) };
  const Component = load(
    "components/pwa/app-entry.tsx",
    {
      "react/jsx-runtime": require("react/jsx-runtime"),
      "next/link": link,
      "next/navigation": { useRouter: () => router },
      react: {
        useState: () => [
          stateIndex++ === 0 ? false : 0,
          (value) => states.push(value),
        ],
        useEffect: (fn) => effects.push(fn),
      },
    },
    {
      AbortController,
      Set,
      fetch: async (url, options) => {
        requests.push([url, options]);
        if (deferred) await deferred;
        return { ok: true, json: async () => ({ destination }) };
      },
      window: {
        matchMedia: () => ({ matches: standalone }),
        setTimeout: () => 1,
        clearTimeout() {},
      },
    },
  ).AppEntry;
  Component({ installedOnly });
  const cleanup = effects[0]();
  return { cleanup, states, routes, requests };
}
test("client entry changes route within the current app document and rejects unlisted destinations", async () => {
  const good = clientEntry();
  await new Promise(setImmediate);
  assert.equal(good.routes[0], "/member");
  assert.equal(good.requests[0][1].cache, "no-store");
  assert.equal(good.requests[0][1].credentials, "same-origin");
  good.cleanup();
  const bad = clientEntry({ destination: "https://example.com" });
  await new Promise(setImmediate);
  assert.equal(bad.routes.length, 0);
  assert.equal(bad.states.at(-1), true);
  bad.cleanup();
});
test("a cancelled launch cannot navigate after a delayed response and public browser entry stays idle", async () => {
  let resolve;
  const deferred = new Promise((done) => {
    resolve = done;
  });
  const f = clientEntry({ deferred });
  f.cleanup();
  resolve();
  await new Promise(setImmediate);
  assert.equal(f.routes.length, 0);
  const browser = clientEntry({ installedOnly: true, standalone: false });
  assert.equal(browser.requests.length, 0);
});

test("the faster launch URL preserves the existing installed app identity", () => {
  const manifest = load("app/manifest.ts", {}).default();
  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/app");
});
