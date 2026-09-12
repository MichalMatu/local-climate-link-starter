#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=ac1d2c900467be4330a09567f286a6c364072c9a
APP_ID=link.localclimate.app
EXPECTED_MODEL=SM-S906B
ARTIFACT_ID=20260912-sensor-data-refresh-flow-audit
ARTIFACT_DIR=.agent/artifacts/$ARTIFACT_ID
TMP_DIR="$(mktemp -d /tmp/lcl-sensor-refresh.XXXXXX)"
CONTROL_DIR="$(mktemp -d /tmp/lcl-sensor-refresh-control.XXXXXX)"
PORT=9234
cleanup() {
  adb forward --remove "tcp:$PORT" >/dev/null 2>&1 || true
  git worktree remove --force "$CONTROL_DIR" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR" "$CONTROL_DIR"
}
trap cleanup EXIT INT TERM

git fetch --prune origin "$BRANCH" agent-control >/dev/null
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

command -v adb >/dev/null 2>&1
command -v curl >/dev/null 2>&1
command -v node >/dev/null 2>&1
adb start-server >/dev/null
SERIALS="$(adb devices -l | awk 'NR>1 && $2=="device" {print $1}')"
COUNT="$(printf '%s\n' "$SERIALS" | sed '/^$/d' | wc -l | tr -d ' ')"
test "$COUNT" -eq 1
SERIAL="$(printf '%s\n' "$SERIALS" | sed -n '1p')"
MODEL="$(adb -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
test "$MODEL" = "$EXPECTED_MODEL"

adb -s "$SERIAL" shell am force-stop "$APP_ID"
adb -s "$SERIAL" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 2
PID="$(adb -s "$SERIAL" shell pidof "$APP_ID" | tr -d '\r' | awk '{print $1}')"
test -n "$PID"
SOCKET="$(adb -s "$SERIAL" shell cat /proc/net/unix 2>/dev/null | tr -d '\r' | awk '{print $NF}' | sed 's/^@//' | grep "webview_devtools_remote_${PID}$" | head -n 1 || true)"
test -n "$SOCKET"
adb -s "$SERIAL" forward "tcp:$PORT" "localabstract:$SOCKET" >/dev/null
curl --fail --silent --show-error "http://127.0.0.1:$PORT/json" > "$TMP_DIR/targets.json"
WS_URL="$(python3 - "$TMP_DIR/targets.json" <<'PY'
import json,sys
for t in json.load(open(sys.argv[1],encoding='utf-8')):
    if t.get('type')=='page' and t.get('webSocketDebuggerUrl'):
        print(t['webSocketDebuggerUrl']); break
PY
)"
test -n "$WS_URL"

cat > "$TMP_DIR/cdp.mjs" <<'JS'
const [wsUrl, command, arg1 = '', arg2 = ''] = process.argv.slice(2);
const ws = new WebSocket(wsUrl);
let nextId = 1;
const pending = new Map();
const opened = new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(String(event.data));
  if (!msg.id) return;
  const waiter = pending.get(msg.id);
  if (!waiter) return;
  pending.delete(msg.id);
  if (msg.error) waiter.reject(new Error(JSON.stringify(msg.error)));
  else waiter.resolve(msg.result);
});
function rpc(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await rpc('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}
function jsString(v) { return JSON.stringify(v); }
async function waitUntil(expression, timeoutMs = 9000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(expression)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timeout waiting for ${expression}`);
}
await opened;
await rpc('Runtime.enable');
let output;
if (command === 'eval') {
  output = await evaluate(arg1);
} else if (command === 'wait-selector') {
  output = await waitUntil(`Boolean(document.querySelector(${jsString(arg1)}))`);
} else if (command === 'click-selector') {
  const index = Number(arg2 || '0');
  await waitUntil(`document.querySelectorAll(${jsString(arg1)}).length > ${index}`);
  output = await evaluate(`(() => { const el=document.querySelectorAll(${jsString(arg1)})[${index}]; el.scrollIntoView({block:'center'}); el.click(); return (el.innerText||el.textContent||'').trim(); })()`);
} else if (command === 'dump') {
  output = await evaluate(`(() => ({
    bodyText:(document.body?.innerText||'').trim(),
    href:location.href,
    climateCardMetrics:Array.from(document.querySelectorAll('.automation-card--climate .automation-card__primary-metric strong,.automation-card--climate .automation-card__secondary-metrics strong')).map(el=>(el.textContent||'').trim()),
    detailMetrics:Array.from(document.querySelectorAll('.installation-detail-live .automation-metrics strong')).map(el=>(el.textContent||'').trim()),
    sensorCards:Array.from(document.querySelectorAll('.sensor-saved-card')).map(card=>({
      name:(card.querySelector('.sensor-card-title')?.textContent||'').trim(),
      metrics:Array.from(card.querySelectorAll('.sensor-data-metric-card__value')).map(el=>(el.textContent||'').trim()),
      details:Array.from(card.querySelectorAll('.sensor-card-details dd')).map(el=>(el.textContent||'').trim())
    })),
    activeTab:(document.querySelector('.setup-top-nav__item--active')?.textContent||'').trim()
  }))()`);
} else {
  throw new Error(`Unknown command ${command}`);
}
process.stdout.write(JSON.stringify(output, null, 2));
ws.close();
JS

cdp() { node "$TMP_DIR/cdp.mjs" "$WS_URL" "$@"; }
wait_selector() { cdp wait-selector "$1" >/dev/null; }
click_selector() { cdp click-selector "$1" "${2:-0}" >/dev/null; }
dump_named() { cdp dump > "$TMP_DIR/$1.json"; }

wait_selector '.dashboard-shell'
click_selector '[data-dashboard-kind="climate"]' 0 || true
sleep 0.25
dump_named dashboard-before-detail

STORED="$(cdp eval "localStorage.getItem('lcl.installedAutomations.v1')")"
printf '%s\n' "$STORED" > "$TMP_DIR/installed-automations.jsonstring"
python3 - "$TMP_DIR/installed-automations.jsonstring" "$TMP_DIR/installation-target.json" <<'PY'
import json,sys
raw=json.load(open(sys.argv[1],encoding='utf-8'))
obj=json.loads(raw) if raw else {'installations':[]}
climate=next((x for x in obj.get('installations',[]) if x.get('kind')!='time'),None)
json.dump(climate or {},open(sys.argv[2],'w',encoding='utf-8'),ensure_ascii=False,indent=2)
PY

if cdp eval "document.querySelectorAll('.automation-card--climate .automation-card__menu').length > 0" | grep -q true; then
  click_selector '.automation-card--climate .automation-card__menu' 0
  wait_selector '.installation-detail-shell'
  for label in 000 100 250 500 1000 2000 4000 8000; do
    case "$label" in
      000) : ;;
      100) sleep 0.1 ;;
      250) sleep 0.15 ;;
      500) sleep 0.25 ;;
      1000) sleep 0.5 ;;
      2000) sleep 1 ;;
      4000) sleep 2 ;;
      8000) sleep 4 ;;
    esac
    dump_named "detail-$label"
  done
  adb -s "$SERIAL" shell input keyevent KEYCODE_BACK
  sleep 0.5
  wait_selector '.dashboard-shell'
  dump_named dashboard-after-detail
fi

# Trace setup tab switching too: climate + -> first climate intent -> sensor -> shelly -> sensor.
click_selector '[data-dashboard-kind="climate"]' 0 || true
click_selector '.dashboard-fab' 0
wait_selector '.intent-shell'
click_selector '.intent-choice' 0
wait_selector '.hardware-shell'
click_selector '.setup-top-nav__item' 1
wait_selector '.sensor-setup-panel'
sleep 1
dump_named sensor-before-shelly-tab
click_selector '.setup-top-nav__item' 0
wait_selector '.shelly-setup-panel'
dump_named shelly-tab-entered
sleep 1
click_selector '.setup-top-nav__item' 1
wait_selector '.sensor-setup-panel'
dump_named sensor-return-000
sleep 0.15
dump_named sensor-return-150
sleep 0.35
dump_named sensor-return-500
sleep 1.5
dump_named sensor-return-2000

# Best-effort direct diagnostic endpoint sampling from Mac; never fail the audit if LAN access is unavailable.
python3 - "$TMP_DIR/installation-target.json" > "$TMP_DIR/diag-target.txt" <<'PY'
import json,sys
x=json.load(open(sys.argv[1],encoding='utf-8'))
if x:
    base=x.get('shelly',{}).get('baseUrl','')
    sid=x.get('script',{}).get('id')
    if base and sid is not None:
        print(base.rstrip('/')+f'/script/{sid}/diag')
PY
DIAG_URL="$(cat "$TMP_DIR/diag-target.txt" 2>/dev/null || true)"
: > "$TMP_DIR/diag-samples.ndjson"
if [ -n "$DIAG_URL" ]; then
  i=0
  while [ "$i" -lt 8 ]; do
    TS="$(date +%s%3N 2>/dev/null || date +%s000)"
    BODY="$(curl --silent --show-error --max-time 2 "$DIAG_URL" 2>/dev/null || true)"
    python3 - "$TS" "$BODY" >> "$TMP_DIR/diag-samples.ndjson" <<'PY'
import json,sys
body=sys.argv[2]
out={'ts':sys.argv[1],'ok':False}
try:
    data=json.loads(body)
    d=data.get('diagnostics',{}) if isinstance(data,dict) else {}
    out.update(ok=True,lastTemp=d.get('lastTemp'),lastHumidity=d.get('lastHumidity'),lastVpd=d.get('lastVpd'),dataState=d.get('dataState'))
except Exception:
    out['bodyLength']=len(body)
print(json.dumps(out,separators=(',',':')))
PY
    i=$((i+1))
    sleep 0.4
  done
fi

python3 - "$TMP_DIR" <<'PY'
import json,glob,os,sys
root=sys.argv[1]
def load(name):
    p=os.path.join(root,name)
    return json.load(open(p,encoding='utf-8')) if os.path.exists(p) else None
summary={
 'dashboardBefore':load('dashboard-before-detail.json'),
 'detailTimeline':[{'t':x.split('-')[-1].split('.')[0],'data':json.load(open(x,encoding='utf-8'))} for x in sorted(glob.glob(os.path.join(root,'detail-*.json')))],
 'dashboardAfter':load('dashboard-after-detail.json'),
 'sensorBeforeShelly':load('sensor-before-shelly-tab.json'),
 'shellyEntered':load('shelly-tab-entered.json'),
 'sensorReturn':[{'t':x.split('-')[-1].split('.')[0],'data':json.load(open(x,encoding='utf-8'))} for x in sorted(glob.glob(os.path.join(root,'sensor-return-*.json')))]
}
json.dump(summary,open(os.path.join(root,'summary.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=2)
print('DASHBOARD_BEFORE='+json.dumps((summary['dashboardBefore'] or {}).get('climateCardMetrics',[]),ensure_ascii=False,separators=(',',':')))
print('DETAIL_TIMELINE='+json.dumps([{'t':x['t'],'metrics':x['data'].get('detailMetrics',[])} for x in summary['detailTimeline']],ensure_ascii=False,separators=(',',':')))
print('SENSOR_BEFORE='+json.dumps((summary['sensorBeforeShelly'] or {}).get('sensorCards',[]),ensure_ascii=False,separators=(',',':')))
print('SENSOR_RETURN='+json.dumps([{'t':x['t'],'cards':x['data'].get('sensorCards',[])} for x in summary['sensorReturn']],ensure_ascii=False,separators=(',',':')))
PY

test -z "$(git status --porcelain)"

git fetch origin agent-control >/dev/null
rm -rf "$CONTROL_DIR"
git worktree add --detach "$CONTROL_DIR" origin/agent-control >/dev/null
mkdir -p "$CONTROL_DIR/$ARTIFACT_DIR"
cp "$TMP_DIR"/*.json "$CONTROL_DIR/$ARTIFACT_DIR/" 2>/dev/null || true
cp "$TMP_DIR"/*.ndjson "$CONTROL_DIR/$ARTIFACT_DIR/" 2>/dev/null || true
cp "$TMP_DIR"/*.txt "$CONTROL_DIR/$ARTIFACT_DIR/" 2>/dev/null || true
printf 'MODEL=%s\nBASE=%s\nPID=%s\n' "$MODEL" "$BASE" "$PID" > "$CONTROL_DIR/$ARTIFACT_DIR/meta.txt"
(
  cd "$CONTROL_DIR"
  git add "$ARTIFACT_DIR"
  git commit -m "Capture sensor refresh flow audit" >/dev/null
  if ! git push origin HEAD:agent-control >/dev/null 2>&1; then
    git fetch origin agent-control >/dev/null
    git rebase origin/agent-control >/dev/null
    git push origin HEAD:agent-control >/dev/null
  fi
  echo AUDIT_CONTROL_SHA=$(git rev-parse HEAD)
)
echo SENSOR_REFRESH_FLOW_AUDIT=1
