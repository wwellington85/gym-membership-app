const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
function load(path, imports = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  runInNewContext(source, {
    exports,
    Date,
    Intl,
    URL,
    URLSearchParams,
    Headers,
    require(name) {
      assert.ok(name in imports, `Unexpected import: ${name}`);
      return imports[name];
    },
  });
  return exports;
}
const status = load("lib/membership/status.ts");
const rules = load("lib/access/rules.ts", {
  "@/lib/membership/status": status,
});
const returns = load("lib/auth/return-to.ts");
const navigation = load("lib/member/navigation.ts", {
  "@/lib/access/rules": rules,
  "@/lib/auth/return-to": returns,
});
const now = new Date("2026-11-12T15:00:00Z");
const pass = {
  status: "active",
  start_date: "2026-11-01",
  paid_through_date: "2026-11-30",
  plan_snapshot: {
    code: "gym_month",
    access_scope: "gym",
    grants_access: true,
    duration_days: 30,
    price: 95,
  },
};

test("active gym access opens Club Home for paid and complimentary members", () => {
  for (const price of [95, 0])
    assert.equal(
      navigation.memberStartPath(
        "auto",
        [{ ...pass, plan_snapshot: { ...pass.plan_snapshot, price } }],
        true,
        now,
      ),
      "/member",
    );
});
test("resort access, expired, future, revoked and inactive memberships default to Home", () => {
  const cases = [
    [],
    [
      {
        ...pass,
        plan_snapshot: {
          ...pass.plan_snapshot,
          code: "club_day",
          access_scope: "resort",
        },
      },
    ],
    [{ ...pass, paid_through_date: "2026-11-11" }],
    [{ ...pass, start_date: "2026-11-13" }],
    [{ ...pass, status: "revoked" }],
  ];
  for (const passes of cases)
    assert.equal(
      navigation.memberStartPath("auto", passes, true, now),
      "/member",
    );
  assert.equal(
    navigation.memberStartPath("auto", [pass], false, now),
    "/member",
  );
});
test("legacy display preferences open Home without altering passes", () => {
  assert.equal(
    navigation.memberStartPath("home", [pass], true, now),
    "/member",
  );
  assert.equal(
    navigation.memberStartPath("gym", [], false, now),
    "/member",
  );
  assert.equal(navigation.startScreenPreference("https://example.com"), "auto");
  assert.equal(pass.status, "active");
});
test("Club Home remains the default across the Jamaica access cutoff", () => {
  const daily = {
    ...pass,
    start_date: "2026-11-12",
    paid_through_date: "2026-11-12",
    plan_snapshot: { ...pass.plan_snapshot, duration_days: 1 },
  };
  assert.equal(
    navigation.memberStartPath(
      "auto",
      [daily],
      true,
      new Date("2026-11-13T02:59:00Z"),
    ),
    "/member",
  );
  assert.equal(
    navigation.memberStartPath(
      "auto",
      [daily],
      true,
      new Date("2026-11-13T03:00:00Z"),
    ),
    "/member",
  );
});
test("secondary screens have stable parents and the correct active tab", () => {
  for (const path of ["/member/check-ins", "/member/leaderboard"]) {
    assert.equal(navigation.memberPageParent(path).href, "/member");
    assert.equal(navigation.memberTab(path), "/member");
  }
  assert.equal(
    navigation.memberPageParent("/member/activity").href,
    "/member/benefits",
  );
  assert.equal(
    navigation.memberPageParent("/member/checkout").href,
    "/member/access",
  );
  for (const path of [
    "/member",
    "/member",
    "/member/card",
    "/member/benefits",
    "/member/settings",
  ])
    assert.equal(navigation.memberPageParent(path), null);
});
test("Back rejects external and self destinations and preserves a safe return path", () => {
  assert.equal(
    navigation.backDestination(
      "https://example.com",
      "/member/gym",
      "/member/check-ins",
    ),
    "/member/gym",
  );
  assert.equal(
    navigation.backDestination(
      "//example.com",
      "/member/gym",
      "/member/check-ins",
    ),
    "/member/gym",
  );
  assert.equal(
    navigation.backDestination(
      "/member/check-ins?page=2",
      "/member/gym",
      "/member/check-ins",
    ),
    "/member/gym",
  );
  assert.equal(
    navigation.backDestination(
      "/member/access?plan=gym_day",
      "/member/gym",
      "/member/upgrade",
    ),
    "/member/access?plan=gym_day",
  );
});
function redirect(location) {
  throw Object.assign(new Error("redirect"), { location });
}
async function redirected(fn) {
  try {
    await fn();
  } catch (error) {
    if (error.location) return error.location;
    throw error;
  }
  assert.fail("Expected a redirect");
}
test("starting screen uses the preference and avoids loading access for explicit choices", async () => {
  for (const [preference, expected] of [
    ["home", "/member"],
    ["gym", "/member"],
    ["auto", "/member"],
  ]) {
    let lookups = 0;
    const Page = load("app/(member)/member/start/page.tsx", {
      "next/navigation": { redirect },
      "@/lib/member/navigation": navigation,
      "@/lib/access/server": {
        requireMember: async () => ({
          user: { user_metadata: { member_start_screen: preference } },
          member: { id: "self", is_active: true },
        }),
        loadAccess: async () => {
          lookups++;
          return { passes: [{ ...pass, paid_through_date: "2099-12-31" }] };
        },
      },
    }).default;
    assert.equal(await redirected(Page), expected);
    assert.equal(lookups, preference === "auto" ? 1 : 0);
  }
});
test("starting screen falls back to Home during an access lookup outage", async () => {
  const Page = load("app/(member)/member/start/page.tsx", {
    "next/navigation": { redirect },
    "@/lib/member/navigation": navigation,
    "@/lib/access/server": {
      requireMember: async () => ({ user: {}, member: { id: "self" } }),
      loadAccess: async () => {
        throw new Error("offline");
      },
    },
  }).default;
  assert.equal(await redirected(Page), "/member");
});
test("saving the preference changes only the current user display metadata", async () => {
  const writes = [];
  const save = load("app/(member)/member/settings/actions.ts", {
    "next/navigation": { redirect },
    "@/lib/access/server": {
      requireMember: async () => ({
        supabase: {
          auth: {
            updateUser: async (payload) => {
              writes.push(payload);
              return { error: null };
            },
          },
        },
      }),
    },
  }).saveStartingScreen;
  for (const preference of ["gym", "home", "auto"]) {
    assert.ok(
      (
        await redirected(() => save(new Map([["starting_screen", preference]])))
      ).includes("preference_saved=1"),
    );
    assert.equal(writes.at(-1).data.member_start_screen, preference);
    assert.equal(Object.keys(writes.at(-1)).join(","), "data");
  }
  const before = writes.length;
  assert.ok(
    (
      await redirected(() => save(new Map([["starting_screen", "external"]])))
    ).includes("err="),
  );
  assert.equal(writes.length, before);
});
test("login gate preserves a member deep link, including payment references", async () => {
  const fn = load("lib/auth/member-login.ts", {
    "next/headers": {
      headers: async () =>
        new Map([
          ["x-member-return-to", "/member/payment-return?payment=reference"],
        ]),
    },
    "./return-to": returns,
  }).memberLoginHref;
  const url = new URL(await fn(), "https://example.com");
  assert.equal(
    url.searchParams.get("returnTo"),
    "/member/payment-return?payment=reference",
  );
});
test("member proxy overwrites any client-supplied return header with the actual route", async () => {
  const proxy = load("proxy.ts", {
    "next/server": { NextResponse: { next: (x) => x } },
    "@supabase/ssr": {},
  }).proxy;
  const response = await proxy({
    nextUrl: { pathname: "/member/card", search: "?view=qr" },
    headers: new Headers({ "x-member-return-to": "https://example.com" }),
  });
  assert.equal(
    response.request.headers.get("x-member-return-to"),
    "/member/card?view=qr",
  );
});
test("gym summary uses only member-filtered visits and reports unavailable data honestly", async () => {
  const calls = [];
  const summary = load("lib/member/leaderboard.ts").getMemberGymSummary;
  const db = {
    rpc: async (name, args) => {
      assert.equal(args.p_member_id, "self");
      return { error: { message: "offline" } };
    },
    from: (table) => {
      assert.equal(table, "checkins");
      const query = {
        eq(key, value) {
          calls.push([key, value]);
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        then(resolve) {
          return Promise.resolve({
            data: null,
            count: null,
            error: { message: "offline" },
          }).then(resolve);
        },
      };
      return { select: () => query };
    },
  };
  const result = await summary(db, "self");
  assert.equal(result.rankingAvailable, false);
  assert.equal(result.allTimeCheckins, null);
  assert.equal(result.streakDays, null);
  assert.equal(result.recentVisits, null);
  assert.equal(calls.length, 2);
  assert.ok(
    calls.every(([key, value]) => key === "member_id" && value === "self"),
  );
});

test("old Gym links redirect to Club visits without losing history", async () => {
  const Page = load("app/(member)/member/gym/page.tsx", {"next/navigation": {redirect}}).default;
  assert.equal(await redirected(Page), "/member#club-visits");
});

test("failed preference saves never show a success message", async () => {
  const save = load("app/(member)/member/settings/actions.ts", {
    "next/navigation": { redirect },
    "@/lib/access/server": {
      requireMember: async () => ({
        supabase: {
          auth: { updateUser: async () => ({ error: { message: "offline" } }) },
        },
      }),
    },
  }).saveStartingScreen;
  const result = await redirected(() =>
    save(new Map([["starting_screen", "gym"]])),
  );
  assert.ok(result.includes("err="));
  assert.ok(!result.includes("preference_saved"));
});

test("Club Monthly and legacy preferences open Club Home", () => {
  const monthly = {
    ...pass,
    plan_snapshot: {
      ...pass.plan_snapshot,
      code: "club_monthly_95",
      access_scope: "resort",
    },
  };
  for (const method of ["cash", "complimentary"]) {
    assert.equal(
      navigation.memberStartPath(
        "auto",
        [{ ...monthly, payment_method: method }],
        true,
        now,
      ),
      "/member",
    );
    assert.equal(
      navigation.memberStartPath(
        "home",
        [{ ...monthly, payment_method: method }],
        true,
        now,
      ),
      "/member",
    );
  }
  const weekly = {
    ...monthly,
    plan_snapshot: { ...monthly.plan_snapshot, code: "club_weekly" },
  };
  assert.equal(
    navigation.memberStartPath("auto", [weekly], true, now),
    "/member",
  );
});

test("expired, future, revoked, inactive, and non-access Club Monthly cannot trigger Gym automatically", () => {
  const monthly = {
    ...pass,
    plan_snapshot: {
      ...pass.plan_snapshot,
      code: "club_monthly_95",
      access_scope: "resort",
    },
  };
  for (const candidate of [
    { ...monthly, paid_through_date: "2026-11-11" },
    { ...monthly, start_date: "2026-11-13" },
    { ...monthly, status: "revoked" },
    {
      ...monthly,
      plan_snapshot: { ...monthly.plan_snapshot, grants_access: false },
    },
  ])
    assert.equal(
      navigation.memberStartPath("auto", [candidate], true, now),
      "/member",
    );
  assert.equal(
    navigation.memberStartPath("auto", [monthly], false, now),
    "/member",
  );
});
