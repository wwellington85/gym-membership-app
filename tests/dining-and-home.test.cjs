const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
function load(path, imports = {}, globals = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    {
      exports,
      Date,
      Intl,
      AbortSignal,
      ...globals,
      require: (name) => {
        assert.ok(name in imports, name);
        return imports[name];
      },
    },
  );
  return exports;
}
const menu = load("lib/dining/menu.ts", {
  "cheerio/slim": require("cheerio/slim"),
});
const footer =
  '<footer class="footer"><p class="allergy">Please tell your server about allergies.</p><p>All prices are quoted in USD and subject to 10% sales tax. Gratuity not included.</p></footer>';
const section = (items) =>
  `<section class="section"><h3 class="section-title">Test dishes</h3>${items}</section>`;
test("menus preserve explicit diet markers, price choices and seasonal notes without inferring dietary claims", () => {
  const html = `<div class="tbr-dinner">${section('<div class="item"><h4 class="item-name">Sample dish <span class="veg">V</span></h4><div class="price-options"><div><span class="price">$18</span><small>Chicken</small></div><div><span class="price">$22</span><small>Shrimp</small></div></div><p class="description">Published description.</p><span class="seasonal">Seasonal item</span></div><div class="item"><h4 class="item-name">Vegetable-named dish</h4><span class="price">$16</span><p class="description">Contains oyster sauce.</p></div>')}${footer}</div>`;
  const result = menu.parseRestaurantMenu(html, "dinner");
  const item = result.sections[0].items[0];
  assert.equal(item.name, "Sample dish");
  assert.equal(item.vegetarian, true);
  assert.equal(item.prices[1].amount, "$22");
  assert.equal(item.prices[1].label, "Shrimp");
  assert.equal(item.note, "Seasonal item");
  assert.equal(result.sections[0].items[1].vegetarian, false);
  const { RestaurantMenuContent } = load(
    "components/member/restaurant-menu.tsx",
    { "react/jsx-runtime": require("react/jsx-runtime") },
  );
  const markup = renderToStaticMarkup(
    React.createElement(RestaurantMenuContent, { menu: result }),
  );
  assert.match(markup, /10% sales tax/);
  assert.match(markup, /Shrimp/);
  assert.match(markup, /Vegetarian option/);
  assert.doesNotMatch(markup, /Order now/);
});
test("breakfast drinks and individually priced sides and lunch per-item sides are extracted", () => {
  const breakfast = menu.parseRestaurantMenu(
    `<div class="tbr-breakfast">${section('<div class="beverage-item"><h4 class="item-name">Test juice</h4><span class="price">$3</span><p class="beverage-options">Two choices</p></div>')}<section class="breakfast-sides"><div class="breakfast-side"><span class="breakfast-side-name">Test side</span><span class="breakfast-side-price">$4</span></div></section>${footer}</div>`,
    "breakfast",
  );
  assert.equal(breakfast.sections[0].items[0].description, "Two choices");
  assert.equal(breakfast.sections[1].items[0].prices[0].amount, "$4");
  const lunch = menu.parseRestaurantMenu(
    `<div class="tbr-lunch">${section('<div class="item"><h4 class="item-name">Sample lunch</h4><span class="price">$9</span></div>')}<section class="sides-panel"><div class="sides-price">$4 each</div><span class="side">First side</span><span class="side">Second side</span></section>${footer}</div>`,
    "lunch",
  );
  assert.equal(lunch.sections[1].items.length, 2);
  assert.equal(lunch.sections[1].items[1].prices[0].label, "each");
});
test("changed menu markup and missing prices fail safely instead of showing empty or invented prices", () => {
  for (const html of [
    "<p>Offline</p>",
    `<div class="tbr-dinner">${section('<div class="item"><h4 class="item-name">Item without a price</h4></div>')}${footer}</div>`,
  ])
    assert.throws(
      () => menu.parseRestaurantMenu(html, "dinner"),
      /unavailable/,
    );
  assert.equal(menu.restaurantMeal("https://other.example/menu"), "breakfast");
  assert.equal(
    menu.menuSource(menu.restaurantMeal("../private")),
    "https://tbr.travel/breakfast-menu/",
  );
});
test("menu loader caches successful parsed results and falls back for unavailable or excessively stale data", async () => {
  let options;
  function server(cached) {
    return load(
      "lib/dining/server.ts",
      {
        "next/cache": {
          unstable_cache: (callback, _key, config) => {
            options = config;
            return cached || callback;
          },
        },
        "./menu": {
          menuSource: menu.menuSource,
          parseRestaurantMenu: () => ({ fetchedAt: new Date().toISOString() }),
        },
      },
      {
        fetch: async () => {
          throw Error("offline");
        },
      },
    );
  }
  assert.equal(await server().loadRestaurantMenu("dinner"), null);
  assert.equal(options.revalidate, 900);
  assert.equal(
    await server(async () => ({
      fetchedAt: "2000-01-01T00:00:00Z",
    })).loadRestaurantMenu("dinner"),
    null,
  );
  assert.ok(
    await server(async () => ({
      fetchedAt: new Date().toISOString(),
    })).loadRestaurantMenu("dinner"),
  );
});
test("Home booking and gift updates are scoped to the signed-in member with status and cutoff filters", async () => {
  const calls = [];
  let failGift = false;
  const admin = {
    from: (table) => {
      const q = {
        select() {
          return this;
        },
        eq: (key, value) => {
          calls.push([table, key, value]);
          return q;
        },
        gte: (key, value) => {
          calls.push([table, key, value]);
          return q;
        },
        or: (value) => {
          calls.push([table, "or", value]);
          return q;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        maybeSingle: async () => {
          if (failGift && table === "reward_gifts") throw Error("offline");
          return { data: { id: table }, error: null };
        },
      };
      return q;
    },
  };
  const status = load("lib/membership/status.ts");
  const { loadHomeUpdates } = load("lib/member/home-updates.ts", {
    "@/lib/membership/status": status,
  });
  const result = await loadHomeUpdates(
    admin,
    "own-member",
    new Date("2026-11-16T03:10:00Z"),
  );
  assert.equal(result.error, false);
  for (const table of ["experience_bookings", "reward_gifts"])
    assert.ok(
      calls.some(
        (c) => c[0] === table && c[1] === "member_id" && c[2] === "own-member",
      ),
    );
  assert.ok(
    calls.some(
      (c) =>
        c[0] === "experience_bookings" &&
        c[1] === "status" &&
        c[2] === "confirmed",
    ),
  );
  assert.ok(
    calls.some(
      (c) =>
        c[0] === "reward_gifts" &&
        c[1] === "valid_until" &&
        c[2] === "2026-11-16",
    ),
  );
  assert.ok(
    calls.some((c) => c[1] === "or" && c[2].includes("start_minute.gt.1330")),
  );
  failGift = true;
  const partial = await loadHomeUpdates(
    admin,
    "own-member",
    new Date("2026-11-16T03:10:00Z"),
  );
  assert.equal(partial.error, true);
  assert.equal(partial.reward, null);
  assert.equal(partial.booking.id, "experience_bookings");
});
