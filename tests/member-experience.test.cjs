const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const now = new Date("2026-11-14T15:00:00Z");
class Clock extends Date {
  constructor(...args) {
    super(...(args.length ? args : [now.getTime()]));
  }
}
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
      Date: Clock,
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
const giftRules = load("lib/rewards/gifts.ts", {
  "@/lib/membership/status": status,
});
const benefitRules = load("lib/access/benefits.ts", { "./rules": rules });
const shared = {
  "react/jsx-runtime": require("react/jsx-runtime"),
  "next/link": {
    default: ({ children, ...props }) =>
      React.createElement("a", props, children),
  },
  "@/lib/access/rules": rules,
  "@/lib/access/benefits": benefitRules,
  "@/lib/format/date": load("lib/format/date.ts"),
};
shared["@/lib/rewards/gifts"] = giftRules;
shared["@/lib/rewards/server"] = {
  loadMemberGifts: async () => ({ gifts: [], error: false }),
};
shared["@/components/member/reward-gifts"] = load(
  "components/member/reward-gifts.tsx",
  shared,
);
shared["@/components/member/upgrade-options"] = load(
  "components/member/upgrade-options.tsx",
  shared,
);
shared["@/components/member/visit-points"] = load(
  "components/member/visit-points.tsx",
  shared,
);
const free = {
  id: "free",
  code: "rewards_free",
  name: "Local Rewards",
  price: 0,
  duration_days: 3650,
  grants_access: false,
  discount_food: 0.05,
  discount_spa: 0,
  discount_giftshop: 0.05,
  discount_watersports: 0,
};
const weekly = {
  ...free,
  id: "weekly",
  code: "club_weekly",
  name: "Club Weekly",
  price: 45,
  duration_days: 7,
  grants_access: true,
  access_scope: "resort",
  discount_food: 0.15,
};
const monthly = {
  ...weekly,
  id: "monthly",
  code: "club_monthly_95",
  name: "Club Monthly",
  price: 95,
  duration_days: 30,
  discount_food: 0.2,
};
const gym = {
  ...weekly,
  id: "gym",
  code: "gym_day",
  name: "Gym Day",
  access_scope: "gym",
  duration_days: 1,
  price: 15,
  discount_food: 0.05,
};
const makePass = (plan, more = {}) => ({
  id: plan.id,
  member_id: "self",
  plan_id: plan.id,
  status: "active",
  start_date: "2026-11-14",
  paid_through_date: "2026-11-30",
  plan_snapshot: plan,
  ...more,
});
async function renderPage(
  page,
  { passes = [], local = false, active = true, pointError = false } = {},
) {
  const current = active
    ? passes.filter((p) => rules.passIsActive(p, now))
    : [];
  const admin = {
    rpc: async () =>
      pointError
        ? { data: null, error: { message: "Unavailable" } }
        : { data: 99, error: null },
    from(name) {
      assert.equal(name, "membership_plan_benefits");
      return {
        select() {
          return this;
        },
        in() {
          return this;
        },
        eq() {
          return this;
        },
        order: async () => ({
          data: [
            {
              id: "local-perk",
              label: "Approved local perk",
              value: "Included",
            },
          ],
          error: null,
        }),
      };
    },
  };
  const Page = load(page, {
    ...shared,
    "@/lib/access/server": {
      requireMember: async () => ({
        member: {
          id: "self",
          full_name: "Example",
          is_active: active,
          local_rewards: local,
        },
        admin,
      }),
      loadAccess: async () => ({ passes, current, best: current[0] ?? null }),
      loadCatalogue: async () => [free, gym, weekly, monthly],
    },
    "@/lib/member/leaderboard": {
      getMemberGymSummary: async () => ({
        allTimeCheckins: 33,
        rankingAvailable: true,
        rank: 2,
        badges: [],
      }),
    },
    "@/lib/format/name": { firstName: () => "Example" },
    "next/image": {
      default: (props) =>
        React.createElement("img", { src: props.src, alt: props.alt }),
    },
    "lucide-react": require("lucide-react"),
  }).default;
  return renderToStaticMarkup(await Page());
}
const home = "app/(member)/member/page.tsx";
const benefits = "app/(member)/member/benefits/page.tsx";
test("free members see earned points and upgrades without zero-rate discounts or unusable benefit instructions", async () => {
  for (const page of [home, benefits]) {
    const html = await renderPage(page);
    assert.match(html, /99/);
    assert.match(html, /points earned|Points earned/);
    assert.match(html, /plan=club_weekly/);
    assert.match(html, /plan=club_monthly_95/);
    assert.doesNotMatch(
      html,
      /(?:>| )0%|today 0%|Your discounts today|Discount history|Approved local perk|How to use a benefit|Jamaica time/,
    );
    assert.match(html, /Selected rewards|selected rewards/);
    assert.doesNotMatch(
      html,
      /30 points|automatically unlock a gift.*Use this reward/,
    );
  }
});
test("Local Rewards shows approved positive discounts and custom perks, without facility entitlement", async () => {
  const html = await renderPage(benefits, { local: true });
  assert.match(html, /Your discounts today/);
  assert.match(html, /5% off/);
  assert.match(html, /Approved local perk/);
  assert.doesNotMatch(html, /Current facility access|>0%|today 0%/);
  assert.match(html, /plan=club_weekly/);
});
test("gym-only, weekly and complimentary monthly members see correct access and relevant upgrades", async () => {
  const gymHtml = await renderPage(benefits, { passes: [makePass(gym)] });
  const accessSection = gymHtml.match(
    /aria-label="Current facility access"([\s\S]*?)<\/section>/,
  )?.[1];
  assert.ok(accessSection);
  assert.match(accessSection, /Gym/);
  assert.doesNotMatch(accessSection, /Pool|Beach/);
  assert.match(gymHtml, /plan=club_weekly/);
  const weeklyHtml = await renderPage(benefits, { passes: [makePass(weekly)] });
  assert.match(weeklyHtml, /plan=club_monthly_95/);
  assert.doesNotMatch(weeklyHtml, /plan=club_weekly/);
  for (const page of [home, benefits]) {
    const html = await renderPage(page, {
      passes: [makePass(monthly, { payment_method: "complimentary" })],
    });
    assert.match(html, /20%/);
    assert.doesNotMatch(
      html,
      /plan=club_weekly|plan=club_monthly_95|Jamaica time/,
    );
  }
});
test("expired and revoked paid passes do not promise discounts; approved base benefits continue", async () => {
  for (const pass of [
    makePass(monthly, {
      paid_through_date: "2026-11-13",
      start_date: "2026-11-01",
    }),
    makePass(monthly, { status: "revoked" }),
  ]) {
    const freeHtml = await renderPage(benefits, { passes: [pass] });
    assert.doesNotMatch(
      freeHtml,
      /Current facility access|Your discounts today|20% off · today/,
    );
    assert.match(freeHtml, /plan=club_monthly_95/);
    const localHtml = await renderPage(benefits, {
      passes: [pass],
      local: true,
    });
    const discountSection = localHtml.match(
      /aria-label="Current discounts"([\s\S]*?)<\/section>/,
    )?.[1];
    assert.match(discountSection, /5% off/);
    assert.doesNotMatch(discountSection, /20% off/);
  }
});
test("scheduled monthly passes show the start date without promising current access or duplicate upgrades", async () => {
  for (const page of [home, benefits]) {
    const html = await renderPage(page, {
      passes: [
        makePass(monthly, {
          start_date: "2026-11-20",
          paid_through_date: "2026-12-19",
        }),
      ],
    });
    assert.match(html, /starts on 20 Nov 2026/);
    assert.doesNotMatch(
      html,
      /Current facility access|Your discounts today|plan=club_monthly_95|plan=club_weekly/,
    );
  }
});
test("inactive accounts retain point history without benefit, upgrade or earning promises", async () => {
  for (const page of [home, benefits]) {
    const html = await renderPage(page, {
      passes: [makePass(monthly)],
      local: true,
      active: false,
    });
    assert.match(html, /front desk/);
    assert.match(html, /99/);
    assert.doesNotMatch(
      html,
      /Current facility access|Your discounts today|Approved local perk|plan=club_weekly|Earn 3 points/,
    );
  }
});
test("point lookup failures show unavailable rather than a false zero balance", async () => {
  const html = await renderPage(benefits, { pointError: true });
  assert.match(html, /points are temporarily unavailable/);
  assert.doesNotMatch(html, />0<\/strong>/);
});

test("issued gifts show use links only while available; consumed history cannot be reused",()=>{
 const {RewardGifts}=shared['@/components/member/reward-gifts'];
 const gift={id:'one',member_id:'self',title:'Selected dessert',terms:'One selected item',valid_until:'2026-11-20',status:'available',created_at:'2026-11-14'};
 const render=(g,active=true)=>renderToStaticMarkup(React.createElement(RewardGifts,{gifts:[g],error:false,active}));
 assert.match(render(gift),/Use this reward/);
 for(const state of ['redeemed','revoked']){const html=render({...gift,status:state});assert.doesNotMatch(html,/Use this reward/);assert.match(html,/Reward history/);}
 assert.doesNotMatch(render({...gift,valid_until:'2000-01-01'}),/Use this reward/);
 assert.doesNotMatch(render(gift,false),/Use this reward/);
});
