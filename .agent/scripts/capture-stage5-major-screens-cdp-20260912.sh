#!/usr/bin/env sh
set -eu

APP_ID=link.localclimate.app
ARTIFACT_ID=20260912-stage5-ui-audit-major-screens
ARTIFACT_DIR=.agent/artifacts/$ARTIFACT_ID
TMP_DIR="$(mktemp -d /tmp/lcl-cdp-major.XXXXXX)"
CONTROL_DIR="$(mktemp -d /tmp/lcl-agent-control.XXXXXX)"
PORT=9224
cleanup() {
  adb forward --remove "tcp:$PORT" >/dev/null 2>&1 || true
  git worktree remove --force "$CONTROL_DIR" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR" "$CONTROL_DIR"
}
trap cleanup EXIT INT TERM

command -v adb >/dev/null 2>&1
command -v curl >/dev/null 2>&1
command -v node >/dev/null 2>&1
command -v sips >/dev/null 2>&1
adb start-server >/dev/null
SERIALS="$(adb devices -l | awk 'NR>1 && $2=="device" {print $1}')"
COUNT="$(printf '%s\n' "$SERIALS" | sed '/^$/d' | wc -l | tr -d ' ')"
if [ "$COUNT" -ne 1 ]; then
  echo "ANDROID_DEVICE_COUNT=$COUNT"
  adb devices -l
  exit 21
fi
SERIAL="$(printf '%s\n' "$SERIALS" | sed -n '1p')"
MODEL="$(adb -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
test "$MODEL" = "SM-S906B"

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
import json, sys
with open(sys.argv[1], encoding='utf-8') as f:
    targets=json.load(f)
for target in targets:
    if target.get('type') == 'page' and target.get('webSocketDebuggerUrl'):
        print(target['webSocketDebuggerUrl'])
        break
PY
)"
test -n "$WS_URL"

cat > "$TMP_DIR/cdp.mjs" <<'JS'
const [wsUrl, command, arg1 = '', arg2 = ''] = process.argv.slice(2);
if (typeof WebSocket !== 'function') {
  throw new Error('Global WebSocket is unavailable in this Node runtime');
}
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
  const result = await rpc('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}
function jsString(value) { return JSON.stringify(value); }
async function waitUntil(expression, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(expression)) return true;
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error(`Timeout waiting for: ${expression}`);
}
await opened;
await rpc('Runtime.enable');
let output = null;
if (command === 'wait-selector') {
  output = await waitUntil(`Boolean(document.querySelector(${jsString(arg1)}))`);
} else if (command === 'click-selector') {
  const index = Number(arg2 || '0');
  await waitUntil(`document.querySelectorAll(${jsString(arg1)}).length > ${index}`);
  output = await evaluate(`(() => { const el = document.querySelectorAll(${jsString(arg1)})[${index}]; el.scrollIntoView({block:'center'}); el.click(); return {tag:el.tagName,text:(el.innerText||el.textContent||'').trim(),aria:el.getAttribute('aria-label')}; })()`);
} else if (command === 'click-text') {
  const wanted = arg1;
  await waitUntil(`Array.from(document.querySelectorAll('button,summary,[role="button"]')).some(el => (el.innerText||el.textContent||'').trim() === ${jsString(wanted)})`);
  output = await evaluate(`(() => { const el = Array.from(document.querySelectorAll('button,summary,[role="button"]')).find(el => (el.innerText||el.textContent||'').trim() === ${jsString(wanted)}); el.scrollIntoView({block:'center'}); el.click(); return {tag:el.tagName,text:(el.innerText||el.textContent||'').trim(),aria:el.getAttribute('aria-label')}; })()`);
} else if (command === 'dump') {
  output = await evaluate(`(() => {
    const selectors = 'button,a,input,select,textarea,summary,[role="button"],[role="tab"],[role="switch"]';
    const elements = Array.from(document.querySelectorAll(selectors)).map((el, index) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        index, tag: el.tagName.toLowerCase(), text: (el.innerText || el.textContent || '').trim().replace(/\\s+/g,' ').slice(0,240),
        ariaLabel: el.getAttribute('aria-label'), title: el.getAttribute('title'), role: el.getAttribute('role'),
        className: typeof el.className === 'string' ? el.className : '',
        disabled: Boolean(el.disabled), ariaCurrent: el.getAttribute('aria-current'), ariaPressed: el.getAttribute('aria-pressed'),
        rect: {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)},
        visible: r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
      };
    }).filter((item) => item.visible);
    return {
      title: document.title,
      href: location.href,
      viewport: {width: innerWidth, height: innerHeight, dpr: devicePixelRatio, scrollY},
      bodyText: (document.body?.innerText || '').trim().replace(/\\n{3,}/g,'\\n\\n').slice(0,16000),
      elements
    };
  })()`);
} else {
  throw new Error(`Unknown command: ${command}`);
}
process.stdout.write(JSON.stringify(output, null, 2));
ws.close();
JS

cdp() {
  node "$TMP_DIR/cdp.mjs" "$WS_URL" "$@"
}
wait_selector() {
  cdp wait-selector "$1" >/dev/null
}
click_selector() {
  cdp click-selector "$1" "${2:-0}" >/dev/null
  sleep 0.45
}
click_text() {
  cdp click-text "$1" >/dev/null
  sleep 0.45
}
capture() {
  name="$1"
  cdp dump > "$TMP_DIR/$name.json"
  adb -s "$SERIAL" exec-out screencap -p > "$TMP_DIR/$name.png"
  sips -Z 780 -s format jpeg -s formatOptions 62 "$TMP_DIR/$name.png" --out "$TMP_DIR/$name-thumb.jpg" >/dev/null
  test -s "$TMP_DIR/$name.png"
  test -s "$TMP_DIR/$name-thumb.jpg"
  printf '%s\n' "$name" >> "$TMP_DIR/screens.txt"
}

wait_selector '.dashboard-shell'
capture dashboard-climate
click_selector '[data-dashboard-kind="time"]'
wait_selector '.dashboard-shell'
capture dashboard-time
click_selector '[data-dashboard-kind="settings"]'
wait_selector '.app-settings-screen'
capture settings
click_selector '[data-dashboard-kind="climate"]'
wait_selector '.dashboard-shell'
click_selector '.dashboard-fab'
wait_selector '.intent-shell'
capture setup-intent
click_selector '.intent-choice' 0
wait_selector '.hardware-shell'
wait_selector '.setup-top-nav'
capture setup-shelly
click_text 'Dodaj gniazdko'
wait_selector '.lcl-modal'
capture setup-shelly-add-modal
click_text 'Zamknij'
wait_selector '.setup-top-nav'
click_selector '.setup-top-nav__item' 1
wait_selector '.sensor-setup-panel'
capture setup-sensor
click_text 'Dodaj termometr'
wait_selector '.lcl-modal'
capture setup-sensor-add-modal
click_text 'Zamknij'
click_selector '.setup-top-nav__item' 2
wait_selector '.field-row'
capture setup-rule

printf 'APP_PID=%s\nSOCKET=%s\nWS_URL=%s\n' "$PID" "$SOCKET" "$WS_URL" > "$TMP_DIR/meta.txt"
adb -s "$SERIAL" shell wm size >> "$TMP_DIR/meta.txt"
adb -s "$SERIAL" shell wm density >> "$TMP_DIR/meta.txt"

# Publish read-only audit artifacts on agent-control only.
git fetch origin agent-control >/dev/null
git worktree add --detach "$CONTROL_DIR" origin/agent-control >/dev/null
mkdir -p "$CONTROL_DIR/$ARTIFACT_DIR"
cp "$TMP_DIR"/*.json "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR"/*-thumb.jpg "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR/meta.txt" "$CONTROL_DIR/$ARTIFACT_DIR/meta.txt"
cp "$TMP_DIR/screens.txt" "$CONTROL_DIR/$ARTIFACT_DIR/screens.txt"
(
  cd "$CONTROL_DIR"
  git add "$ARTIFACT_DIR"
  if ! git diff --cached --quiet; then
    git commit -m "Capture Stage 5 major UI screens" >/dev/null
    git push origin HEAD:agent-control >/dev/null
  fi
  echo "AUDIT_CONTROL_SHA=$(git rev-parse HEAD)"
)

cat "$TMP_DIR/screens.txt" | sed 's/^/CAPTURED_SCREEN=/'
echo STAGE5_MAJOR_SCREENS_CDP_CAPTURE=1
