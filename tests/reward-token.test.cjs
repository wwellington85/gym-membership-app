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
        esModuleInterop: true,
      },
    }).outputText,
    {
      exports,
      Date,
      Buffer,
      require(n) {
        assert.ok(n in imports, n);
        return imports[n];
      },
    },
  );
  return exports;
}
const qr = load("lib/qr/token.ts", { crypto: require("crypto") });
const reward = load("lib/rewards/token.ts", { "@/lib/qr/token": qr });
const mid = "00000000-0000-4000-8000-000000000001",
  rid = "00000000-0000-4000-8000-000000000002",
  secret = "test-only-secret";
test("reward QR binds member and gift, is domain separated from membership QR, and rejects tampering", () => {
  const issued = reward.signRewardToken(mid, rid, secret);
  const decoded = reward.verifyRewardToken(issued.token, secret);
  assert.equal(decoded.memberId, mid);
  assert.equal(decoded.giftId, rid);
  assert.equal(reward.verifyRewardToken(issued.token, "wrong-secret"), null);
  assert.equal(reward.verifyRewardToken(issued.token + "x", secret), null);
  const now = Math.floor(Date.now() / 1000),
    claims = { mid, jti: rid, iat: now, exp: now + 90 };
  assert.equal(
    reward.verifyRewardToken(
      "TBR-REWARD:" + qr.signQrToken(claims, secret),
      secret,
    ),
    null,
  );
  assert.equal(
    qr.verifyQrToken(issued.token.slice("TBR-REWARD:".length), secret).ok,
    false,
  );
  assert.equal(
    reward.verifyRewardToken(
      "TBR-REWARD:" +
        qr.signQrToken(
          { ...claims, iat: now - 91, exp: now - 1 },
          secret + "|reward-gift-v1",
        ),
      secret,
    ),
    null,
  );
  assert.equal(
    reward.verifyRewardToken(
      "TBR-REWARD:" +
        qr.signQrToken(
          { ...claims, exp: now + 900 },
          secret + "|reward-gift-v1",
        ),
      secret,
    ),
    null,
  );
});
