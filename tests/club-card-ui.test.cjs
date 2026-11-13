const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
function load(path, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      Date,
      Intl,
      require(name) {
        assert.ok(name in imports, name);
        return imports[name];
      },
      ...globals,
    },
  );
  return exports;
}
const dates = load("lib/format/date.ts");
const status = load("lib/membership/status.ts");
const rules = load("lib/access/rules.ts", {
  "@/lib/membership/status": status,
});
const link = {
  default: ({ children, ...props }) =>
    React.createElement("a", props, children),
};
const shared = {
  "react/jsx-runtime": require("react/jsx-runtime"),
  "lucide-react": require("lucide-react"),
  "next/link": link,
  "@/lib/access/rules": rules,
  "@/lib/format/date": dates,
};
const { MembershipCard } = load(
  "components/member/membership-card.tsx",
  shared,
);

test("digital card preserves the full lookup number and current membership, with no invented QR", () => {
  const html = renderToStaticMarkup(
    React.createElement(MembershipCard, {
      memberId: "00000000-0000-4000-8000-000000000001",
      name: "Example Member With A Long Name",
      product: "Club Monthly",
      validThrough: "2026-12-11",
      active: true,
      showCardLink: true,
    }),
  );
  assert.match(html, /TC-00000000000040008000000000000001/);
  assert.match(html, /<summary[^>]*>TC · …00000001/);
  assert.match(html, /show full membership number/);
  assert.doesNotMatch(html, /<details[^>]*\bopen\b/);
  assert.match(html, /Club Monthly/);
  assert.match(html, /11 Dec 2026/);
  assert.match(html, /href="\/member\/card"/);
  assert.doesNotMatch(html, /<img/);
});
test("inactive card shows verification required rather than active entitlements", () => {
  const html = renderToStaticMarkup(
    React.createElement(MembershipCard, {
      memberId: "self",
      name: "Example",
      active: false,
    }),
  );
  assert.match(html, /Verification required/);
  assert.match(html, /front desk/);
  assert.doesNotMatch(html, /Access until/);
});
test("membership date formatting retains Jamaica calendar dates", () => {
  assert.equal(dates.membershipDate("2026-12-11"), "11 Dec 2026");
  assert.equal(dates.membershipDate("unknown"), "unknown");
});
test("member navigation retains all five labelled links and marks the selected Gym section", () => {
  const navigation = load("lib/member/navigation.ts", {
    "@/lib/access/rules": rules,
    "@/lib/auth/return-to": load("lib/auth/return-to.ts"),
  });
  const { MemberTabs } = load(
    "components/nav/member-tabs.tsx",
    {
      ...shared,
      "next/navigation": { usePathname: () => "/member/leaderboard" },
      react: { useState: () => [true], useEffect() {} },
      "react-dom": { createPortal: (node) => node },
      "@/lib/member/navigation": navigation,
    },
    { document: { body: {} } },
  );
  const html = renderToStaticMarkup(React.createElement(MemberTabs));
  for (const label of ["Home", "Gym", "Card", "Benefits", "Account"])
    assert.ok(html.includes(`>${label}</span>`));
  assert.match(html, /href="\/member\/gym" aria-current="page"/);
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
});

function hsl(value) {
  const [h, s, l] = value.split(/\s+/).map(Number);
  const sat = s / 100,
    light = l / 100;
  return [0, 8, 4].map((n) => {
    const k = (n + h / 30) % 12;
    return (
      light -
      sat * Math.min(light, 1 - light) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    );
  });
}
function hex(value) {
  return value.match(/\w\w/g).map((x) => parseInt(x, 16) / 255);
}
function contrast(a, b) {
  const lum = (c) =>
    c
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
test("Club card text and field boundaries meet contrast targets on actual defined surfaces", () => {
  const css = fs.readFileSync("app/globals.css", "utf8");
  const token = (name) =>
    hsl(css.match(new RegExp(`--${name}:\\s*([^;]+);`))[1].replaceAll("%", ""));
  for (const [text, bg] of [
    ["foreground", "background"],
    ["muted-foreground", "background"],
    ["primary-foreground", "primary"],
    ["primary", "secondary"],
  ])
    assert.ok(contrast(token(text), token(bg)) >= 4.5, `${text} on ${bg}`);
  assert.ok(
    contrast(token("input"), token("background")) >= 3,
    "Input boundary",
  );
  for (const [text, bg] of [
    ["d4dfe7", "1d4058"],
    ["ffffff", "1d4058"],
    ["23624e", "eef6f1"],
    ["7b4f10", "fff5df"],
    ["922d2d", "fff1f1"],
  ])
    assert.ok(contrast(hex(text), hex(bg)) >= 4.5, `${text} on ${bg}`);
});

test("staff navigation preserves role-specific destinations and marks only the current scan destination", () => {
  for (const role of ["admin", "front_desk", "security"]) {
    const { StaffSidebar } = load("components/nav/staff-sidebar.tsx", {
      ...shared,
      "next/navigation": { usePathname: () => "/checkins/scan" },
    });
    const html = renderToStaticMarkup(
      React.createElement(StaffSidebar, { role }),
    );
    assert.equal(html.includes('href="/payments"'), role !== "security");
    assert.equal(html.includes('href="/applications"'), role !== "security");
    assert.equal(html.includes('href="/more"'), role === "admin");
    assert.match(
      html,
      /href="\/checkins\/scan" class="club-sidebar-link" aria-current="page"/,
    );
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  }
});
