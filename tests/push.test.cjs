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
        esModuleInterop: true,
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
const subscriptions = load("lib/push/subscription.ts");
const sub = {
  endpoint: "https://web.push.apple.com/opaque-endpoint",
  keys: {
    p256dh: Buffer.alloc(65, 4).toString("base64url"),
    auth: Buffer.alloc(16, 1).toString("base64url"),
  },
};
test("push subscriptions accept supported HTTPS services and reject SSRF, credentials and malformed keys", () => {
  assert.ok(subscriptions.parsePushSubscription(sub));
  for (const endpoint of [
    "http://web.push.apple.com/a",
    "https://127.0.0.1/a",
    "https://169.254.169.254/a",
    "https://web.push.apple.com.attacker.example/a",
    "https://attacker.example/a",
    "https://user:pass@web.push.apple.com/a",
    "https://web.push.apple.com:8080/a",
  ])
    assert.equal(
      subscriptions.parsePushSubscription({ ...sub, endpoint }),
      null,
    );
  assert.equal(
    subscriptions.parsePushSubscription({
      ...sub,
      keys: { ...sub.keys, auth: "bad" },
    }),
    null,
  );
});
const status = load("lib/membership/status.ts"),
  gifts = load("lib/rewards/gifts.ts", { "@/lib/membership/status": status });
function delivery({ seen = false, code, prior = false } = {}) {
  const state = { sends: 0, removed: 0, noted: 0, status: null };
  const admin = {
    rpc: async (name) => {
      if (name === "claim_reward_push") return { data: "gift", error: null };
      if (name === "note_reward_push_delivery") {
        state.noted++;
        return { error: null };
      }
      throw Error(name);
    },
    from() {
      const q = {
        select() {
          return q;
        },
        eq() {
          return q;
        },
        delete() {
          state.removed++;
          return q;
        },
        update(value) {
          state.status = value.status;
          return q;
        },
        maybeSingle: async () => ({
          data: {
            id: "gift",
            member_id: "member",
            status: "available",
            valid_until: "2099-01-01",
            seen_at: seen ? "read" : null,
            members: { is_active: true },
          },
          error: null,
        }),
        limit: async () => ({
          data: [
            {
              id: "device",
              ...sub,
              auth: sub.keys.auth,
              p256dh: sub.keys.p256dh,
            },
          ],
          error: null,
        }),
        single: async () => ({
          data: { sent_subscription_ids: prior ? ["device"] : [], attempts: 1 },
          error: null,
        }),
        then(resolve) {
          resolve({ error: null });
        },
      };
      return q;
    },
  };
  const send = async (_subscription, payload, options) => {
    state.sends++;
    assert.ok(options.timeout <= 4000);
    assert.ok(options.TTL <= 86400);
    const data = JSON.parse(payload);
    assert.equal(data.url, "/member/benefits#member-rewards");
    assert.doesNotMatch(payload, /member_id|private reason|Selected cocktail/);
    if (code) throw { statusCode: code };
    return {};
  };
  const dispatcher = load(
    "lib/push/delivery.ts",
    {
      "web-push": { sendNotification: send },
      "./subscription": subscriptions,
      "@/lib/rewards/gifts": gifts,
    },
    {
      WEB_PUSH_PUBLIC_KEY: "public",
      WEB_PUSH_PRIVATE_KEY: "private",
      WEB_PUSH_SUBJECT: "mailto:test@example.com",
    },
  );
  return { state, run: () => dispatcher.deliverRewardPush(admin, "gift") };
}
test("delivery is user-visible and generic, remembers successful devices, removes expired endpoints and retries failures", async () => {
  const normal = delivery();
  await normal.run();
  assert.equal(normal.state.sends, 1);
  assert.equal(normal.state.noted, 1);
  assert.equal(normal.state.status, "sent");
  const already = delivery({ prior: true });
  await already.run();
  assert.equal(already.state.sends, 0);
  const read = delivery({ seen: true });
  await read.run();
  assert.equal(read.state.sends, 0);
  assert.equal(read.state.status, "skipped");
  const gone = delivery({ code: 410 });
  await gone.run();
  assert.equal(gone.state.removed, 1);
  assert.equal(gone.state.status, "sent");
  const retry = delivery({ code: 503 });
  await retry.run();
  assert.equal(retry.state.status, "pending");
});
