#!/bin/sh
set -eu

FINAL=ea9ffc2cd81f037955639cf8f750005c1831663b
SERIAL=RFCT70L7E8J
PACKAGE=link.localclimate.app
WORK_BRANCH=work/manual-runtime-mode-20260911
TMP="$(mktemp -d)"
trap 'adb forward --remove tcp:9222 >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT

git fetch --prune origin
git checkout -B "$WORK_BRANCH" "origin/$WORK_BRANCH" >/dev/null
test "$(git rev-parse HEAD)" = "$FINAL"
test -z "$(git status --porcelain)"
echo PHYSICAL_TEST_SHA="$(git rev-parse HEAD)"

adb start-server >/dev/null
test "$(adb -s "$SERIAL" get-state)" = device
test "$(adb -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')" = SM-S906B
echo PHONE_OK=SM-S906B

# Build and install the exact committed source while preserving app data.
pnpm --filter @lcl/mobile build
(cd apps/mobile && pnpm exec cap sync android)
(cd apps/mobile/android && ./gradlew assembleDebug)
APK=apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
test -s "$APK"
adb -s "$SERIAL" install -r "$APK" >/dev/null
adb -s "$SERIAL" shell am force-stop "$PACKAGE"
adb -s "$SERIAL" shell am start -n "$PACKAGE/.MainActivity" >/dev/null
sleep 4
PID="$(adb -s "$SERIAL" shell pidof "$PACKAGE" | tr -d '\r')"
test -n "$PID"
echo PHONE_APP_PID="$PID"

# Recover the exact saved Shelly URL from the app sandbox without printing the
# app data or the URL. This is the same proven discovery mechanism as the prior
# read-only resource measurement.
adb -s "$SERIAL" exec-out run-as "$PACKAGE" sh -c 'cd /data/user/0/'"$PACKAGE"' && tar -cf - .' > "$TMP/appdata.tar"
strings "$TMP/appdata.tar" \
  | grep -Eo 'https?://([0-9]{1,3}\.){3}[0-9]{1,3}(:[0-9]+)?/?' \
  | sort -u > "$TMP/candidates.txt" || true

cat > "$TMP/rpc.py" <<'PY'
import json, sys, time, urllib.request
from pathlib import Path

base_path = Path(sys.argv[1])

def rpc(base, method, params=None, timeout=5):
    body = {"id": 1, "method": method}
    if params is not None:
        body["params"] = params
    req = urllib.request.Request(base + '/rpc', data=json.dumps(body).encode(), headers={'Content-Type':'application/json'}, method='POST')
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        payload = json.loads(resp.read().decode())
    if 'error' in payload:
        raise RuntimeError(f"{method}: {payload['error']}")
    return payload.get('result', payload)

def diag(base, script_id):
    with urllib.request.urlopen(f"{base}/script/{script_id}/diag", timeout=5) as resp:
        return json.loads(resp.read().decode())

def mode_value(value):
    if isinstance(value, dict) and 'result' in value:
        value = value['result']
    return str(value).strip().strip('"')

def find_base(candidate_file):
    candidates = [x.strip().rstrip('/') for x in Path(candidate_file).read_text().splitlines() if x.strip()]
    found=[]
    for base in candidates:
        try:
            info=rpc(base,'Shelly.GetDeviceInfo')
            if isinstance(info,dict) and info.get('id'):
                found.append((base,info))
        except Exception:
            pass
    if len(found)!=1:
        raise SystemExit(f'Expected exactly one saved reachable Shelly, found {len(found)}')
    base,info=found[0]
    base_path.write_text(base)
    print('SHELLY_ID='+str(info.get('id')))
    print('SHELLY_MODEL='+str(info.get('model')))
    print('SHELLY_FW='+str(info.get('fw_id')))

def managed(base):
    payload=rpc(base,'Script.List')
    scripts=payload.get('scripts',[]) if isinstance(payload,dict) else []
    matches=[s for s in scripts if s.get('name')=='Local Climate Link Thermostat']
    if len(matches)!=1:
        raise SystemExit(f'Expected one managed thermostat script, found {len(matches)}')
    return matches[0]

def code(base,sid):
    off=0; chunks=[]
    while True:
        p=rpc(base,'Script.GetCode',{'id':sid,'offset':off,'len':1024})
        data=p.get('data',''); chunks.append(data); off += len(data.encode())
        if int(p.get('left',0) or 0)<=0: break
    return ''.join(chunks)

def snapshot(label, require_mode=None, require_v02=False):
    base=base_path.read_text().strip(); s=managed(base); sid=int(s['id'])
    st=rpc(base,'Script.GetStatus',{'id':sid}); sw=rpc(base,'Switch.GetStatus',{'id':0}); sy=rpc(base,'Sys.GetStatus')
    mv=mode_value(rpc(base,'Script.Eval',{'id':sid,'code':'typeof R==="object"&&typeof R.m==="number"?R.m:-1'})) if st.get('running') else 'stopped'
    src=code(base,sid); head=' | '.join(src.splitlines()[:4])
    print(f'{label}_SCRIPT_ID={sid}')
    print(f'{label}_RUNNING={str(bool(st.get("running"))).lower()}')
    print(f'{label}_MODE={mv}')
    print(f'{label}_RELAY={str(bool(sw.get("output"))).lower()}')
    print(f'{label}_CODE_BYTES={len(src.encode())}')
    print(f'{label}_HEADER={head}')
    for k in ('mem_used','mem_peak','mem_free','cpu'):
        print(f'{label}_SCRIPT_{k.upper()}={st.get(k)}')
    print(f'{label}_RAM_FREE={sy.get("ram_free")}')
    print(f'{label}_RAM_SIZE={sy.get("ram_size")}')
    if require_v02:
        if '// g: 0.2.0' not in src: raise SystemExit('Managed script is not generator 0.2.0')
        if not st.get('running'): raise SystemExit('Managed 0.2 runtime is not running')
        for k in ('mem_used','mem_peak','mem_free'):
            if st.get(k) is None: raise SystemExit(f'Running runtime missing {k}')
    if require_mode is not None and mv != str(require_mode):
        raise SystemExit(f'Expected runtime mode {require_mode}, got {mv}')
    return sid

def manual_probe():
    base=base_path.read_text().strip(); s=managed(base); sid=int(s['id'])
    before=rpc(base,'Switch.GetStatus',{'id':0})
    if before.get('output'):
        rpc(base,'Switch.Set',{'id':0,'on':False})
    mode=mode_value(rpc(base,'Script.Eval',{'id':sid,'code':'sw(true,"hw",false);R.m'}))
    time.sleep(1)
    after=rpc(base,'Switch.GetStatus',{'id':0})
    print('MANUAL_AUTOMATION_PROBE_MODE='+mode)
    print('MANUAL_AUTOMATION_PROBE_RELAY='+str(bool(after.get('output'))).lower())
    if mode!='1' or after.get('output'):
        raise SystemExit('MANUAL automatic-output gate failed')

def diag_probe():
    base=base_path.read_text().strip(); sid=int(managed(base)['id'])
    d1=diag(base,sid); time.sleep(4); d2=diag(base,sid)
    print('DIAG1='+json.dumps(d1,separators=(',',':')))
    print('DIAG2='+json.dumps(d2,separators=(',',':')))
    y1=d1.get('y'); y2=d2.get('y')
    if not isinstance(y1,list) or not isinstance(y2,list): raise SystemExit('diag missing system uptime')
    if len(y1)<3 or len(y2)<3 or y1[2] is None or y2[2] is None or float(y2[2]) < float(y1[2]):
        raise SystemExit('diag did not remain live')
    g2=d2.get('g')
    if not isinstance(g2,list): raise SystemExit('diag missing BLE/runtime telemetry')
    print('DIAG_LIVE_OK=1')

def force_off():
    base=base_path.read_text().strip()
    rpc(base,'Switch.Set',{'id':0,'on':False})
    sw=rpc(base,'Switch.GetStatus',{'id':0})
    print('FINAL_RELAY='+str(bool(sw.get('output'))).lower())
    if sw.get('output'): raise SystemExit('Could not leave relay OFF')

cmd=sys.argv[2]
if cmd=='find': find_base(sys.argv[3])
elif cmd=='snapshot': snapshot(sys.argv[3], None if len(sys.argv)<5 else sys.argv[4], '--v02' in sys.argv)
elif cmd=='manual-probe': manual_probe()
elif cmd=='diag-probe': diag_probe()
elif cmd=='force-off': force_off()
else: raise SystemExit('unknown rpc command')
PY

python3 "$TMP/rpc.py" "$TMP/base.txt" find "$TMP/candidates.txt"
python3 "$TMP/rpc.py" "$TMP/base.txt" snapshot BEFORE

# Attach to the exact app WebView.
adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:webview_devtools_remote_$PID" >/dev/null
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:9222/json > "$TMP/pages.json"; then break; fi
  sleep 1
done
test -s "$TMP/pages.json"

cat > "$TMP/ui.mjs" <<'JS'
import {readFile} from 'node:fs/promises';
const [pagesPath, action] = process.argv.slice(2);
const pages=JSON.parse(await readFile(pagesPath,'utf8'));
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
async function connect(url){
 const ws=new WebSocket(url); let id=0; const pending=new Map();
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('CDP open timeout')),5000);ws.addEventListener('open',()=>{clearTimeout(t);resolve()},{once:true});ws.addEventListener('error',()=>reject(new Error('CDP error')),{once:true});});
 ws.addEventListener('message',e=>{const m=JSON.parse(String(e.data));if(!m.id)return;const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result)});
 const call=(method,params={})=>{const n=++id;const p=new Promise((resolve,reject)=>pending.set(n,{resolve,reject}));ws.send(JSON.stringify({id:n,method,params}));return p};
 await call('Runtime.enable'); return {ws,call};
}
async function ev(call,expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});return r?.result?.value}
let session;
for(const p of pages.filter(x=>x.type==='page'&&x.webSocketDebuggerUrl)){
 try{const c=await connect(p.webSocketDebuggerUrl);if(await ev(c.call,"Boolean(document.querySelector('.app-shell'))")){session=c;break}c.ws.close()}catch{}
}
if(!session) throw new Error('Local Climate Link WebView not found');
const {ws,call}=session;
async function clickSelector(sel){const ok=await ev(call,`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;e.click();return true})()`);if(!ok)throw new Error('selector missing '+sel)}
async function clickText(text, scope='document'){const ok=await ev(call,`(()=>{const root=${scope};const e=[...root.querySelectorAll('button')].find(x=>(x.textContent||'').trim()===${JSON.stringify(text)}&&!x.disabled);if(!e)return false;e.click();return true})()`);if(!ok)throw new Error('enabled button missing '+text)}
async function ensureDetail(){
 if(await ev(call,"Boolean(document.querySelector('.installation-detail-shell'))"))return;
 if(!(await ev(call,"Boolean(document.querySelector('.dashboard-shell'))"))) { await clickSelector('[data-dashboard-kind="climate"]'); await wait(400); }
 await clickSelector('.automation-card--climate .automation-card__menu'); await wait(600);
}
async function state(label){const x=await ev(call,`(()=>({label:${JSON.stringify(label)},detail:Boolean(document.querySelector('.installation-detail-shell')),recovery:Boolean(document.querySelector('.installation-detail-recovery')),recoveryText:document.querySelector('.installation-detail-recovery')?.textContent?.trim()||null,auto:[...document.querySelectorAll('.installation-detail-mode-control button')].find(x=>(x.textContent||'').trim()==='AUTO')?.getAttribute('aria-pressed')||null,manual:[...document.querySelectorAll('.installation-detail-mode-control button')].find(x=>(x.textContent||'').trim()==='MANUAL')?.getAttribute('aria-pressed')||null,autoDisabled:[...document.querySelectorAll('.installation-detail-mode-control button')].find(x=>(x.textContent||'').trim()==='AUTO')?.disabled??null,manualDisabled:[...document.querySelectorAll('.installation-detail-mode-control button')].find(x=>(x.textContent||'').trim()==='MANUAL')?.disabled??null,onDisabled:[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='ON')?.disabled??null,offDisabled:[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='OFF')?.disabled??null,live:document.querySelector('.installation-detail-live')?.textContent?.trim()||null}))()`);console.log('PHONE_UI_'+label+'='+JSON.stringify(x));return x}
async function poll(pred, ms=30000){const end=Date.now()+ms;while(Date.now()<end){if(await pred())return;await wait(300)}throw new Error('UI timeout')}
try{
 await ensureDetail(); await state('START');
 if(action==='recover-manual'){
   if(await ev(call,"Boolean(document.querySelector('.installation-detail-recovery'))")){
     const ok=await ev(call,"(()=>{const e=document.querySelector('.installation-detail-recovery button:not([disabled])');if(!e)return false;e.click();return true})()");
     if(!ok)throw new Error('recovery action unavailable');
     await poll(()=>ev(call,"!document.querySelector('.installation-detail-recovery') && [...document.querySelectorAll('.installation-detail-mode-control button')].some(x=>(x.textContent||'').trim()==='MANUAL'&&!x.disabled)"),45000);
   }
   await clickText('MANUAL',"document.querySelector('.installation-detail-mode-control')");
   await poll(()=>ev(call,"[...document.querySelectorAll('.installation-detail-mode-control button')].some(x=>(x.textContent||'').trim()==='MANUAL'&&x.getAttribute('aria-pressed')==='true')"));
   const s=await state('MANUAL'); if(s.manual!=='true'||s.onDisabled!==false||s.offDisabled!==false)throw new Error('MANUAL UI contract failed');
 } else if(action==='auto'){
   await clickText('AUTO',"document.querySelector('.installation-detail-mode-control')");
   await poll(()=>ev(call,"[...document.querySelectorAll('.installation-detail-mode-control button')].some(x=>(x.textContent||'').trim()==='AUTO'&&x.getAttribute('aria-pressed')==='true')"));
   const s=await state('AUTO'); if(s.auto!=='true')throw new Error('AUTO UI contract failed');
 } else if(action==='manual'){
   await clickText('MANUAL',"document.querySelector('.installation-detail-mode-control')");
   await poll(()=>ev(call,"[...document.querySelectorAll('.installation-detail-mode-control button')].some(x=>(x.textContent||'').trim()==='MANUAL'&&x.getAttribute('aria-pressed')==='true')")); await state('MANUAL_FINAL');
 } else { await state('INSPECT'); }
 console.log('PHONE_UI_ACTION_OK='+action);
} finally { ws.close(); }
JS

# Recover the stopped/legacy runtime through the phone UI if needed and enter
# MANUAL immediately. This exercises the real app migration path.
node "$TMP/ui.mjs" "$TMP/pages.json" recover-manual
sleep 2
python3 "$TMP/rpc.py" "$TMP/base.txt" snapshot MANUAL 1 --v02
python3 "$TMP/rpc.py" "$TMP/base.txt" manual-probe
python3 "$TMP/rpc.py" "$TMP/base.txt" diag-probe

# Verify return to AUTO through the phone UI, then put the device back into
# MANUAL/OFF as the conservative final hardware state.
node "$TMP/ui.mjs" "$TMP/pages.json" auto
sleep 1
python3 "$TMP/rpc.py" "$TMP/base.txt" snapshot AUTO 0 --v02
node "$TMP/ui.mjs" "$TMP/pages.json" manual
sleep 1
python3 "$TMP/rpc.py" "$TMP/base.txt" snapshot FINAL_MANUAL 1 --v02
python3 "$TMP/rpc.py" "$TMP/base.txt" force-off

adb -s "$SERIAL" exec-out screencap -p > "$TMP/final.png"
test -s "$TMP/final.png"
test "$(git rev-parse HEAD)" = "$FINAL"
test -z "$(git status --porcelain)"
echo PHYSICAL_MANUAL_RUNTIME_OK=1
