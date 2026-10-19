const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

// Exercise the actual server action with isolated Auth/DB boundaries.
function loadModule(path, imports) {
  const source = ts.transpileModule(readFileSync(resolve(__dirname, "..", path), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
  }).outputText;
  const exports = {};
  runInNewContext(source, { exports, require: (name) => {
    assert.ok(name in imports, `Unexpected import: ${name}`);
    return imports[name];
  }, URLSearchParams });
  return exports;
}

const returnToHelpers = loadModule("lib/auth/return-to.ts", {});

function setup(options = {}) {
  const updates = [];
  let adminCreated = false;
  const query = (result) => ({
    select() { return this; },
    eq() { return this; },
    async maybeSingle() { return result; },
  });
  const { setStaffPassword } = loadModule("app/(staff)/settings/staff/actions.ts", {
    "next/navigation": { redirect(location) { throw Object.assign(new Error("redirect"), { location }); } },
    "@/lib/auth/return-to": returnToHelpers,
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: options.signedOut ? null : { id: "admin-id" } } }) },
      from: () => query({ data: { role: options.role ?? "admin", is_active: options.active ?? true } }),
    }) },
    "@/lib/supabase/admin": { createAdminClient: () => {
      adminCreated = true;
      return {
        from: () => query({ data: options.missingTarget ? null : {
          user_id: "staff-id", email: options.email === undefined ? "desk@staff.local" : options.email,
        }, error: options.targetError }),
        auth: { admin: { updateUserById: async (id, payload) => {
          updates.push({ id, ...payload });
          return { error: options.updateError };
        } } },
      };
    } },
  });
  return {
    updates,
    get adminCreated() { return adminCreated; },
    async submit(overrides = {}) {
      const form = new FormData();
      for (const [key, value] of Object.entries({
        user_id: "staff-id", password: "new password 123", confirm: "new password 123",
        returnTo: "/settings/staff?q=desk&active=active", ...overrides,
      })) form.set(key, value);
      try { await setStaffPassword(form); } catch (error) {
        if (error.location) return new URL(error.location, "http://localhost");
        throw error;
      }
      assert.fail("Expected redirect");
    },
  };
}

for (const email of ["desk@staff.local", "Desk@STAFF.LOCAL", null, ""]) {
  test(`admin sets password without email (${email}) and preserves filters`, async () => {
    const ctx = setup({ email });
    const result = await ctx.submit();
    assert.equal(result.pathname, "/settings/staff");
    assert.equal(result.searchParams.get("saved"), "1");
    assert.equal(result.searchParams.get("q"), "desk");
    assert.equal(result.searchParams.get("active"), "active");
    assert.deepEqual(ctx.updates, [{ id: "staff-id", password: "new password 123" }]);
    assert.ok(!result.href.includes("new password"));
  });
}

for (const options of [{ signedOut: true }, { role: "front_desk" }, { role: "security" }, { active: false }]) {
  test(`rejects unauthorized caller ${JSON.stringify(options)}`, async () => {
    const ctx = setup(options);
    const result = await ctx.submit();
    assert.equal(result.pathname, options.signedOut ? "/auth/login" : "/dashboard");
    assert.equal(ctx.adminCreated, false);
    assert.equal(ctx.updates.length, 0);
  });
}

for (const [fields, expected] of [
  [{ password: "short", confirm: "short" }, "at least 8"],
  [{ confirm: "different" }, "do not match"],
  [{ user_id: "" }, "Missing staff"],
]) {
  test(`validates input: ${expected}`, async () => {
    const ctx = setup();
    const result = await ctx.submit(fields);
    assert.ok(result.searchParams.get("err").includes(expected));
    assert.equal(ctx.updates.length, 0);
  });
}

for (const options of [{ missingTarget: true }, { targetError: { message: "DB failure" } }, { email: "staff@example.com" }]) {
  test(`rejects invalid target ${JSON.stringify(options)}`, async () => {
    const ctx = setup(options);
    const result = await ctx.submit();
    assert.ok(result.searchParams.get("err"));
    assert.equal(ctx.updates.length, 0);
  });
}

test("reports Auth failure without showing success", async () => {
  const ctx = setup({ updateError: { message: "Password policy failed" } });
  const result = await ctx.submit();
  assert.equal(result.searchParams.get("err"), "Password policy failed");
  assert.equal(result.searchParams.has("saved"), false);
});

test("discards external return URLs", async () => {
  const ctx = setup();
  const result = await ctx.submit({ returnTo: "https://example.com" });
  assert.equal(result.origin, "http://localhost");
  assert.equal(result.pathname, "/settings/staff");
});
