const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, imports = {}, env = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,URL,process:{env},require(name){assert.ok(name in imports,name);return imports[name];}});
  return exports;
}
const returns=load('lib/auth/return-to.ts');
function helpers(enabled) {return load('lib/auth/google.ts',{'@/lib/auth/return-to':returns},{GOOGLE_AUTH_ENABLED:enabled?'true':'false'});}
const next={'NextResponse':{redirect:url=>({url:String(url)})}};
test('Google guest flow rejects external and staff return paths',()=>{
 const h=helpers(true);
 for(const path of ['https://evil.test','//evil.test','/dashboard','/auth/update-password','/member\\evil']) assert.equal(h.googleReturnTo(path),'');
 assert.equal(h.googlePostLoginPath('/member/card'),'/auth/post-login?returnTo=%2Fmember%2Fcard');
 assert.equal(h.googlePostLoginPath(''),' /auth/post-login'.trim());
});
test('disabled Google flow never contacts auth provider',async()=>{
 const r=load('app/auth/google/route.ts',{'next/server':next,'@/lib/auth/google':helpers(false),'@/lib/supabase/server':{createClient:()=>{throw Error('must not run');}}});
 const result=await r.GET(new Request('https://club.tbr.travel/auth/google'));
 assert.match(result.url,/\/auth\/login\?err=/);
});
test('Google start uses server PKCE client and same-origin callback',async()=>{
 let options;
 const r=load('app/auth/google/route.ts',{'next/server':next,'@/lib/auth/google':helpers(true),'@/lib/supabase/server':{createClient:async()=>({auth:{signInWithOAuth:async value=>{options=value;return {data:{url:'https://accounts.google.com/authorize'}};}}})}});
 const result=await r.GET(new Request('https://club.tbr.travel/auth/google?returnTo=%2Fmember%2Fcard'));
 assert.equal(result.url,'https://accounts.google.com/authorize');
 assert.equal(options.provider,'google');
 assert.equal(options.options.redirectTo,'https://club.tbr.travel/auth/google/callback?returnTo=%2Fmember%2Fcard');
 assert.equal(options.options.skipBrowserRedirect,true);
 assert.equal(options.options.queryParams.prompt,'select_account');
});
test('Google callback exchanges code before shared account setup',async()=>{
 let received;
 const r=load('app/auth/google/callback/route.ts',{'next/server':next,'@/lib/auth/google':helpers(true),'@/lib/supabase/server':{createClient:async()=>({auth:{exchangeCodeForSession:async code=>{received=code;return {error:null};}}})}});
 const result=await r.GET(new Request('https://club.tbr.travel/auth/google/callback?code=example&returnTo=%2Fmember%2Fcard'));
 assert.equal(received,'example');
 assert.equal(result.url,'https://club.tbr.travel/auth/post-login?returnTo=%2Fmember%2Fcard');
});
test('denied Google callback returns readable recovery without exposing provider details',async()=>{
 const r=load('app/auth/google/callback/route.ts',{'next/server':next,'@/lib/auth/google':helpers(true),'@/lib/supabase/server':{createClient:()=>{throw Error('must not run');}}});
 const result=await r.GET(new Request('https://club.tbr.travel/auth/google/callback?error=access_denied&error_description=private'));
 assert.match(result.url,/\/auth\/login\?err=/);assert.doesNotMatch(result.url,/private|access_denied/);
});
