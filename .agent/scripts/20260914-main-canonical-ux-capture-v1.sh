#!/usr/bin/env bash
set -euo pipefail
REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
ADB=/opt/homebrew/bin/adb
SERIAL=RFCT70L7E8J
PKG=link.localclimate.app
ACTIVITY=.MainActivity
BASE=56a90240029ce19690e96ad02057cc4150ba537f
OUT=artifacts/ux-reference/main-20260914
cd "$REPO"

git fetch origin main agent-control
git checkout main
git reset --hard origin/main
git clean -fd
[ "$(git rev-parse HEAD)" = "$BASE" ] || { echo "Unexpected main HEAD: $(git rev-parse HEAD)"; exit 2; }
"$ADB" -s "$SERIAL" get-state | grep -qx device
"$ADB" -s "$SERIAL" shell am force-stop "$PKG"
"$ADB" -s "$SERIAL" shell am start -W -n "$PKG/$ACTIVITY" >/dev/null
sleep 1
SOCKET=$("$ADB" -s "$SERIAL" shell cat /proc/net/unix | sed -n 's/.*@\(webview_devtools_remote[^[:space:]]*\).*/\1/p' | head -n 1 | tr -d '\r')
[ -n "$SOCKET" ] || { echo WEBVIEW_DEVTOOLS_AVAILABLE=no; exit 3; }
"$ADB" -s "$SERIAL" forward --remove tcp:9222 >/dev/null 2>&1 || true
"$ADB" -s "$SERIAL" forward tcp:9222 "localabstract:$SOCKET" >/dev/null

rm -rf artifacts/ui-audit "$OUT"
mkdir -p "$OUT/android"

export LCL_REPO="$REPO" LCL_OUT="$OUT" LCL_ADB="$ADB" LCL_SERIAL="$SERIAL"
cat > /tmp/lcl-main-capture.mjs <<'NODE'
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const repo=process.env.LCL_REPO, out=process.env.LCL_OUT, adb=process.env.LCL_ADB, serial=process.env.LCL_SERIAL;
const targets=await (await fetch('http://127.0.0.1:9222/json/list')).json();
const wsUrl=targets.find(t=>t.type==='page')?.webSocketDebuggerUrl;
if(!wsUrl) throw new Error('No WebView page target');
const ws=new WebSocket(wsUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
let seq=0; const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result)}};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});return r.result?.value};
const pause=(ms=450)=>new Promise(r=>setTimeout(r,ms));
await send('Runtime.enable');
const click=async(label,{starts=false,optional=false}={})=>{
  const result=await ev(`(()=>{const label=${JSON.stringify(label)};const els=[...document.querySelectorAll('button,summary,a,[role="button"],[role="tab"]')];const norm=s=>(s||'').replace(/\\s+/g,' ').trim();const hit=els.find(e=>{const vals=[norm(e.innerText),norm(e.getAttribute('aria-label')),norm(e.getAttribute('title'))];return vals.some(v=>${starts?'v.startsWith(label)':'v===label'})});if(!hit)return null;hit.click();return {tag:hit.tagName,text:norm(hit.innerText),aria:hit.getAttribute('aria-label')};})()`);
  if(!result&&!optional) throw new Error(`Could not click ${label}`);
  await pause(); return result;
};
const closeModal=async()=>{await click('Close',{optional:true});await click('Cancel',{optional:true});await pause(250)};
const top=async()=>{await ev(`(()=>{document.scrollingElement?.scrollTo(0,0);document.querySelectorAll('.modal__body,.modal__content').forEach(e=>e.scrollTop=0);return true})()`);await pause(120)};
const manifest=[];
const capture=async(name,description)=>{
  await top(); const body=(await ev('document.body.innerText'))||'';
  const file=join(repo,out,'android',`${name}.png`);
  execFileSync(adb,['-s',serial,'exec-out','screencap','-p'],{stdio:['ignore',require('node:fs').openSync(file,'w'),'inherit']});
  writeFileSync(join(repo,out,'android',`${name}.txt`),body+'\n');
  manifest.push({name,description}); console.log(`CAPTURE=${name}`);
};
await capture('01-dashboard-climate','Climate dashboard with saved automation.');
await click('Details:',{starts:true});
await capture('02-climate-detail','Saved climate automation detail.');
await ev(`(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return true})()`); await pause(250);
await capture('03-climate-detail-expanded','Climate detail with progressive sections expanded.');
await click('Climate');
await click('Settings');
await capture('04-settings','App settings default state.');
await ev(`(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return true})()`); await pause(250);
await capture('05-settings-expanded','App settings with progressive diagnostics expanded.');
await click('Climate');
await click('Time');
await capture('06-dashboard-time','Time dashboard / empty time category.');
await click('Add automation');
await capture('07-time-setup-shelly','Time automation Shelly selection step.');
if(await click('Add plug',{optional:true})) { await capture('08-time-add-plug','Add Shelly modal in time setup.'); await closeModal(); }
await click('Schedule');
await capture('09-time-schedule','Time schedule editor.');
const onButton=await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>(e.getAttribute('aria-label')||'').startsWith('Turn ON at:'));if(!b)return false;b.click();return true})()`);
if(onButton){await pause();await capture('10-time-wheel-picker','Custom HH/MM wheel picker with fade and centered selection.');await click('Cancel');}
await click('Cancel');
await click('Climate');
await click('Add automation');
await capture('11-setup-intent','Climate automation goal chooser.');
await click('Control humidity');
await capture('12-climate-setup-shelly','Climate setup Shelly step.');
if(await click('Add plug',{optional:true})) { await capture('13-climate-add-plug','Add Shelly modal with LAN scan disclosure.'); await closeModal(); }
await click('Sensors');
await capture('14-climate-setup-sensors','Climate setup saved thermometers.');
if(await click('Add thermometer',{optional:true})) { await capture('15-add-thermometer','Add BLE thermometer modal.'); await closeModal(); }
await click('Rule');
await capture('16-climate-setup-rule','Climate rule editor default state.');
await ev(`(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return true})()`);await pause(250);
await capture('17-climate-rule-expanded','Rule editor with Advanced and Developer tools disclosed.');
if(await click('Open advanced options',{optional:true})) { await capture('18-rule-advanced-modal','Advanced safety/runtime rule settings modal.'); await closeModal(); }
await ev(`(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return true})()`);await pause(150);
if(await click('Script preview',{optional:true})) { await capture('19-rule-script-preview','Generated script preview workspace modal.'); await closeModal(); }
await ev(`(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return true})()`);await pause(150);
if(await click('Open technical diagnostics',{optional:true})) { await pause(700); await capture('20-developer-diagnostics','Developer diagnostics screen reached from Rule.'); }
ws.close();
writeFileSync(join(repo,out,'manifest.json'),JSON.stringify({sourceBranch:'main',sourceSha:'56a90240029ce19690e96ad02057cc4150ba537f',device:'Samsung SM-S906B',serial:'RFCT70L7E8J',captureDate:'2026-09-14',screenshots:manifest},null,2)+'\n');
NODE
# Node ESM does not expose require; patch screenshot fd helper to use imported openSync.
python3 - <<'PY'
p='/tmp/lcl-main-capture.mjs'
s=open(p).read()
s=s.replace("import { mkdirSync, writeFileSync } from 'node:fs';", "import { mkdirSync, writeFileSync, openSync, closeSync } from 'node:fs';")
s=s.replace("execFileSync(adb,['-s',serial,'exec-out','screencap','-p'],{stdio:['ignore',require('node:fs').openSync(file,'w'),'inherit']});", "const fd=openSync(file,'w'); try{execFileSync(adb,['-s',serial,'exec-out','screencap','-p'],{stdio:['ignore',fd,'inherit']});} finally{closeSync(fd);}")
open(p,'w').write(s)
PY
node /tmp/lcl-main-capture.mjs

cat > "$OUT/README.md" <<'EOF'
# Main UX visual reference — 2026-09-14

These screenshots are the canonical visual/interaction reference for the UX restoration pass.

- Source branch: `main`
- Source SHA: `56a90240029ce19690e96ad02057cc4150ba537f`
- Physical device: Samsung SM-S906B (`RFCT70L7E8J`)
- Capture method: installed Android app + WebView DevTools navigation + physical `adb screencap`
- App data was preserved; no uninstall/clear was performed.

Important: this directory is a **visual reference only**. The old `main` domain/storage architecture is not a reference for implementation. UX restoration must stay on the refactored device/rule branch and must not reintroduce `InstalledAutomation`, the persisted hardware setup draft, or legacy setup/runtime ownership.

`android/*.txt` contains the visible text at capture time and is included only to make the reference searchable. `manifest.json` records the exact source SHA and capture list.

The older working audit under `artifacts/ui-audit/` was removed when this canonical set was created. Play Store assets under `assets/play-store/` are release collateral and are intentionally retained; they are not the canonical UX restoration reference.
EOF

COUNT=$(find "$OUT/android" -name '*.png' -type f | wc -l | tr -d ' ')
[ "$COUNT" -ge 15 ] || { echo "Too few screenshots: $COUNT"; exit 4; }
for f in "$OUT"/android/*.png; do file "$f" | grep -q 'PNG image data'; done

git add -A artifacts
git status --short
GIT_SHA_BEFORE=$(git rev-parse HEAD)
git commit --no-verify -m "Refresh canonical main UX reference"
git push origin main
FINAL_HEAD=$(git rev-parse HEAD)
REMOTE_HEAD=$(git ls-remote origin refs/heads/main | awk '{print $1}')
[ "$FINAL_HEAD" = "$REMOTE_HEAD" ]
echo "SOURCE_HEAD=$GIT_SHA_BEFORE"
echo "SCREENSHOT_COUNT=$COUNT"
echo "FINAL_HEAD=$FINAL_HEAD"
