const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const { buildAuthEmailTemplates } = require('../scripts/lib/auth-email-templates.cjs');

function load(path, imports) {
  const source = ts.transpileModule(readFileSync(resolve(__dirname, '..', path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  runInNewContext(source, { exports, URL, URLSearchParams, process: { env: {} }, require(name) {
    assert.ok(name in imports, `Unexpected import: ${name}`);
    return imports[name];
  }});
  return exports;
}
const returns = load('lib/auth/return-to.ts', {});
function handler(auth) {
  return load('app/auth/confirm/route.ts', {
    'next/server': { NextResponse: { redirect: url => new URL(url) } },
    '@/lib/supabase/server': { createClient: async () => ({ auth }) },
    '@/lib/auth/return-to': returns,
  }).GET;
}

for (const [type, next] of [['email', '/auth/post-login'], ['recovery', '/auth/update-password']]) {
  test(`email token verification (${type}) works without a PKCE verifier`, async () => {
    const calls = [];
    const get = handler({ verifyOtp: async payload => { calls.push(payload); return { error: null }; },
      exchangeCodeForSession: () => assert.fail('Must not exchange a browser-bound code') });
    const response = await get({ url: `https://club.tbr.travel/auth/confirm?token_hash=test-hash&type=${type}&next=${encodeURIComponent(next)}` });
    assert.equal(response.pathname, next);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].token_hash, 'test-hash');
    assert.equal(calls[0].type, type);
    assert.ok(!response.href.includes('test-hash'));
  });
}
test('invalid email token does not redirect to a signed-in page', async () => {
  const response = await handler({ verifyOtp: async () => ({ error: { message: 'Token expired' } }) })({ url: 'https://club.tbr.travel/auth/confirm?token_hash=invalid&type=email' });
  assert.equal(response.pathname, '/auth/error');
});
test('email verification cannot redirect to an external site', async () => {
  const response = await handler({ verifyOtp: async () => ({ error: null }) })({ url: 'https://club.tbr.travel/auth/confirm?token_hash=test&type=email&next=https://example.com' });
  assert.equal(response.origin, 'https://club.tbr.travel');
  assert.equal(response.pathname, '/auth/post-login');
});
test('older browser-bound emails still have a supported callback', async () => {
  let exchanged = false;
  const response = await handler({ exchangeCodeForSession: async () => { exchanged = true; return { error: null }; } })({ url: 'https://club.tbr.travel/auth/confirm?code=old-code' });
  assert.equal(exchanged, true);
  assert.equal(response.pathname, '/auth/post-login');
});
test('email templates preserve branding and use independent verification links', () => {
  const html = '<body><h1>Travellers Club</h1><table role="presentation" cellpadding="0"><a href="{{ .ConfirmationURL }}">Continue</a></table></body>';
  const config = Object.fromEntries(['magic_link', 'confirmation', 'recovery'].map(kind => [`mailer_templates_${kind}_content`, html]));
  const updates = buildAuthEmailTemplates(config);
  for (const content of Object.values(updates)) {
    assert.ok(content.includes('<h1>Travellers Club</h1>'));
    assert.ok(content.includes('token_hash={{ .TokenHash }}'));
    assert.ok(!content.includes('.ConfirmationURL'));
  }
  assert.ok(updates.mailer_templates_magic_link_content.includes('{{ .Token }}'));
  assert.ok(updates.mailer_templates_recovery_content.includes('type=recovery&amp;next=%2Fauth%2Fupdate-password'));
  assert.throws(() => buildAuthEmailTemplates({}), /Expected/);
  assert.ok(config.mailer_templates_magic_link_content.includes('.ConfirmationURL'));
});
