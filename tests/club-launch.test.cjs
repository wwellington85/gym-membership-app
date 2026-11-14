const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
function fixture({
  ready = false,
  reduced = false,
  standalone = true,
  decode,
} = {}) {
  const states = [],
    effects = [],
    timers = [],
    observers = [];
  let marker = ready;
  const exports = {};
  class Observer {
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
    observe() {}
    disconnect() {}
  }
  const imports = {
    react: {
      useState: () => ["holding", (value) => states.push(value)],
      useRef: () => ({ current: false }),
      useEffect: (fn) => effects.push(fn),
    },
    "next/navigation": { usePathname: () => "/member" },
    "react/jsx-runtime": require("react/jsx-runtime"),
  };
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync("components/pwa/club-launch.tsx", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          jsx: ts.JsxEmit.ReactJSX,
        },
      },
    ).outputText,
    {
      exports,
      require: (name) => imports[name],
      Date,
      MutationObserver: Observer,
      document: {
        body: {},
        querySelector: (selector) =>
          selector.includes(" img")
            ? decode
              ? { complete: false, decode }
              : null
            : marker
              ? {}
              : null,
      },
      window: {
        matchMedia: (query) => ({
          matches: query.includes("standalone") ? standalone : reduced,
        }),
        setTimeout: (fn, delay) => {
          timers.push({ fn, delay });
          return timers.length;
        },
        clearTimeout() {},
      },
    },
  );
  const tree = exports.ClubLaunch();
  const cleanup = effects[0]();
  return {
    tree,
    states,
    timers,
    cleanup,
    ready() {
      marker = true;
      observers[0].callback();
    },
  };
}
test("launch holds until Home arrives, then schedules a fade rather than removing the overlay", async () => {
  const f = fixture();
  assert.equal(f.timers.length, 1);
  assert.equal(f.timers[0].delay, 5000);
  f.ready();
  await new Promise(setImmediate);
  assert.equal(f.states.length, 0);
  const hold = f.timers.find((t) => t.delay <= 1100);
  assert.ok(hold);
  hold.fn();
  assert.equal(f.states.at(-1), "leaving");
  f.cleanup();
});
test("hero decoding delays the reveal, with an escape if the image never resolves", async () => {
  let finish;
  const f = fixture({
    ready: true,
    decode: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  assert.equal(f.timers.length, 1);
  assert.equal(f.timers[0].delay, 5000);
  finish();
  await new Promise(setImmediate);
  assert.ok(f.timers.some((t) => t.delay <= 1100));
  f.cleanup();
  const stuck = fixture({ ready: true, decode: () => new Promise(() => {}) });
  stuck.timers[0].fn();
  assert.equal(stuck.states.at(-1), "leaving");
  stuck.cleanup();
});
test("reduced motion and ordinary browsers skip the launch", () => {
  for (const options of [{ reduced: true }, { standalone: false }])
    assert.equal(fixture(options).states.at(-1), "hidden");
});
test("unmounting before the hero resolves cannot schedule a late transition", async () => {
  let finish;
  const f = fixture({
    ready: true,
    decode: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  f.cleanup();
  finish();
  await new Promise(setImmediate);
  assert.equal(f.timers.length, 1);
  assert.equal(f.states.length, 0);
});
