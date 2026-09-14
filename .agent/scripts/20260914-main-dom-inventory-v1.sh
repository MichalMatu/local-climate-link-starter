#!/usr/bin/env bash
set -euo pipefail
REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
ADB=/opt/homebrew/bin/adb
SERIAL=RFCT70L7E8J
PKG=link.localclimate.app
ACTIVITY=.MainActivity
cd "$REPO"

git fetch origin main agent-control
git checkout main
git reset --hard origin/main
git clean -fd
"$ADB" -s "$SERIAL" get-state | grep -qx device
"$ADB" -s "$SERIAL" shell am force-stop "$PKG"
"$ADB" -s "$SERIAL" shell am start -W -n "$PKG/$ACTIVITY" >/dev/null
sleep 1
SOCKET=$("$ADB" -s "$SERIAL" shell cat /proc/net/unix | sed -n 's/.*@\(webview_devtools_remote[^[:space:]]*\).*/\1/p' | head -n 1 | tr -d '\r')
[ -n "$SOCKET" ]
"$ADB" -s "$SERIAL" forward --remove tcp:9222 >/dev/null 2>&1 || true
"$ADB" -s "$SERIAL" forward tcp:9222 "localabstract:$SOCKET" >/dev/null
cat > /tmp/lcl-cdp-inventory.mjs <<'NODE'
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const wsUrl = targets.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
if (!wsUrl) throw new Error('No page target');
const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const {resolve, reject} = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
};
const send = (method, params={}) => new Promise((resolve,reject) => {
  const mid = ++id; pending.set(mid,{resolve,reject}); ws.send(JSON.stringify({id:mid,method,params}));
});
const evalExpr = async (expression) => {
  const r = await send('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true});
  return r.result?.value;
};
await send('Runtime.enable');
console.log('TITLE='+await evalExpr('document.title'));
console.log('URL='+await evalExpr('location.href'));
console.log('BODY_START');
console.log(await evalExpr('document.body.innerText'));
console.log('BODY_END');
console.log('INTERACTIVE_START');
console.log(JSON.stringify(await evalExpr(`Array.from(document.querySelectorAll('button,a,input,select,[role="button"],[role="tab"]')).map((e,i)=>({i,tag:e.tagName,text:(e.innerText||e.value||e.getAttribute('aria-label')||'').trim(),aria:e.getAttribute('aria-label'),role:e.getAttribute('role'),type:e.getAttribute('type'),cls:e.className})).filter(x=>x.text||x.aria)`), null, 2));
console.log('INTERACTIVE_END');
console.log('LOCALSTORAGE_START');
console.log(JSON.stringify(await evalExpr(`Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))`), null, 2));
console.log('LOCALSTORAGE_END');
ws.close();
NODE
node /tmp/lcl-cdp-inventory.mjs
