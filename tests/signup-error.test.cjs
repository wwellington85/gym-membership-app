const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const exportsObject = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync("lib/auth/signup-error.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText,
  { exports: exportsObject },
);
const { signupErrorMessage } = exportsObject;
test("weak-password rejection explains how to recover rather than reporting generic signup failure", () => {
  assert.match(
    signupErrorMessage({ code: "weak_password" }),
    /too weak or easy to guess/,
  );
  assert.match(
    signupErrorMessage({ name: "AuthWeakPasswordError", reasons: ["pwned"] }),
    /known to be compromised/,
  );
  assert.match(
    signupErrorMessage({ name: "AuthWeakPasswordError", reasons: ["length"] }),
    /stronger, unique password/,
  );
});
test("email and request rate limits give actionable retry guidance", () => {
  assert.match(
    signupErrorMessage({ code: "over_email_send_rate_limit" }),
    /Wait a while/,
  );
  assert.match(signupErrorMessage({ status: 429 }), /Too many attempts/);
  assert.match(
    signupErrorMessage({ code: "over_request_rate_limit" }),
    /Too many attempts/,
  );
});
test("invalid email and connectivity errors are distinguished", () => {
  assert.match(
    signupErrorMessage({ code: "email_address_invalid" }),
    /Check your email/,
  );
  assert.match(
    signupErrorMessage({ name: "AuthRetryableFetchError" }),
    /Check your connection/,
  );
});
test("unexpected and existing-account errors never echo raw private backend details", () => {
  for (const error of [
    null,
    {},
    new Error("database private detail"),
    { code: "user_already_exists", message: "member@example.com exists" },
  ]) {
    const result = signupErrorMessage(error);
    assert.match(result, /sign in if you already have an account/);
    assert.doesNotMatch(result, /private detail|member@example/);
  }
});
