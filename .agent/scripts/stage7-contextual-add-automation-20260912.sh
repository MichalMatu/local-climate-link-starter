#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=18dd578a7252d8b96b4c9bd8952070a63ccc1fb8
APP_ID=link.localclimate.app
EXPECTED_MODEL=SM-S906B
APK=apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
ARTIFACT_ID=20260912-stage7-contextual-add-audit
ARTIFACT_DIR=.agent/artifacts/$ARTIFACT_ID
TMP_DIR="$(mktemp -d /tmp/lcl-stage7.XXXXXX)"
CONTROL_DIR="$(mktemp -d /tmp/lcl-stage7-control.XXXXXX)"
PORT=9232
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

python3 - <<'PY'
from pathlib import Path

routes = Path('apps/mobile/src/routes/AppRoutes.tsx')
s = routes.read_text(encoding='utf-8')
old = """  if (route.type === 'setup') {\n    return { type: 'intent', sourceKind: route.sourceKind };\n  }\n"""
new = """  if (route.type === 'setup') {\n    return route.intent === 'time'\n      ? { type: 'dashboard', kind: 'time' }\n      : { type: 'intent', sourceKind: route.sourceKind };\n  }\n"""
assert old in s, 'setup Android-back route block missing'
s = s.replace(old, new, 1)
old = """        onAddAutomation={(kind) => navigate({ type: 'intent', sourceKind: kind })}\n"""
new = """        onAddAutomation={(kind) =>\n          kind === 'time'\n            ? navigate({ type: 'setup', intent: 'time', sourceKind: 'time' })\n            : navigate({ type: 'intent', sourceKind: 'climate' })\n        }\n"""
assert old in s, 'dashboard add handler missing'
s = s.replace(old, new, 1)
old = """        onBackToIntent={() => navigate({ type: 'intent', sourceKind: route.sourceKind })}\n"""
new = """        onBackToIntent={() =>\n          navigate(\n            route.intent === 'time'\n              ? { type: 'dashboard', kind: 'time' }\n              : { type: 'intent', sourceKind: route.sourceKind }\n          )\n        }\n"""
assert old in s, 'setup back handler missing'
s = s.replace(old, new, 1)
routes.write_text(s, encoding='utf-8')

intent = Path('apps/mobile/src/screens/SetupIntentScreen.tsx')
s = intent.read_text(encoding='utf-8')
old = """  {\n    id: 'humidity',\n    titleKey: 'intent.humidity.title',\n    descriptionKey: 'intent.humidity.description'\n  },\n  {\n    id: 'time',\n    titleKey: 'intent.time.title',\n    descriptionKey: 'intent.time.description'\n  }\n"""
new = """  {\n    id: 'humidity',\n    titleKey: 'intent.humidity.title',\n    descriptionKey: 'intent.humidity.description'\n  }\n"""
assert old in s, 'time intent choice block missing'
s = s.replace(old, new, 1)
intent.write_text(s, encoding='utf-8')

tests = Path('apps/mobile/src/__tests__/app-routes.test.tsx')
s = tests.read_text(encoding='utf-8')
old = """    expect(screen.getByRole('button', { name: /Sterować wilgotnością/ })).toBeVisible();\n    expect(screen.getByRole('button', { name: /Sterować według czasu/ })).toBeVisible();\n"""
new = """    expect(screen.getByRole('button', { name: /Sterować wilgotnością/ })).toBeVisible();\n    expect(screen.queryByRole('button', { name: /Sterować według czasu/ })).toBeNull();\n"""
assert old in s, 'climate intent expectation missing'
s = s.replace(old, new, 1)
old = """  it('returns from Add automation to the dashboard tab that opened it', () => {\n    renderRoutes();\n    fireEvent.click(screen.getByRole('button', { name: 'Czas' }));\n    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(\n      'aria-current',\n      'page'\n    );\n    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));\n    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(\n      'aria-current',\n      'page'\n    );\n    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));\n    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();\n    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(\n      'aria-current',\n      'page'\n    );\n  });\n"""
new = """  it('opens time setup directly from the Time plus and returns to Time dashboard', async () => {\n    renderRoutes();\n    fireEvent.click(screen.getByRole('button', { name: 'Czas' }));\n    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(\n      'aria-current',\n      'page'\n    );\n    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));\n    expect(await screen.findByText('mock-setup-time')).toBeVisible();\n    expect(screen.queryByRole('heading', { name: 'Co chcesz zrobić?' })).toBeNull();\n    fireEvent.click(screen.getByRole('button', { name: 'mock-back' }));\n    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();\n    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(\n      'aria-current',\n      'page'\n    );\n  });\n"""
assert old in s, 'old time Add automation return test missing'
s = s.replace(old, new, 1)
old = """  it('opens the selected goal, keeps global nav in setup, and completes to dashboard', async () => {\n    renderRoutes();\n    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));\n    fireEvent.click(screen.getByRole('button', { name: /Sterować według czasu/ }));\n    expect(await screen.findByText('mock-setup-time')).toBeVisible();\n    act(() => addClimateInstallation('setup-complete'));\n    fireEvent.click(screen.getByRole('button', { name: 'mock-complete' }));\n    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();\n    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(\n      'aria-current',\n      'page'\n    );\n  });\n"""
new = """  it('completes direct Time setup back to the Time dashboard', async () => {\n    renderRoutes();\n    fireEvent.click(screen.getByRole('button', { name: 'Czas' }));\n    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));\n    expect(await screen.findByText('mock-setup-time')).toBeVisible();\n    fireEvent.click(screen.getByRole('button', { name: 'mock-complete' }));\n    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();\n    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(\n      'aria-current',\n      'page'\n    );\n  });\n"""
assert old in s, 'old selected time goal test missing'
s = s.replace(old, new, 1)
tests.write_text(s, encoding='utf-8')
PY

pnpm exec prettier --write \
  apps/mobile/src/routes/AppRoutes.tsx \
  apps/mobile/src/screens/SetupIntentScreen.tsx \
  apps/mobile/src/__tests__/app-routes.test.tsx
pnpm quality:ux
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run src/__tests__/app-routes.test.tsx
pnpm --filter @lcl/mobile test -- --run
pnpm check

CHANGED="$(git diff --name-only)"
EXPECTED="apps/mobile/src/__tests__/app-routes.test.tsx
apps/mobile/src/routes/AppRoutes.tsx
apps/mobile/src/screens/SetupIntentScreen.tsx"
test "$CHANGED" = "$EXPECTED"
! grep -q "id: 'time'" apps/mobile/src/screens/SetupIntentScreen.tsx
grep -q "kind === 'time'" apps/mobile/src/routes/AppRoutes.tsx

git add $CHANGED
git commit -m "Scope add automation by dashboard tab" >/dev/null
CANDIDATE="$(git rev-parse HEAD)"
test "$(git rev-parse HEAD^)" = "$BASE"
git push origin "$BRANCH" >/dev/null
test "$(git rev-parse origin/$BRANCH)" = "$CANDIDATE"
test -z "$(git status --porcelain)"
echo STAGE7_SHA=$CANDIDATE
echo STAGE7_PARENT=$BASE
echo STAGE7_CHECKS=1

command -v adb >/dev/null 2>&1
adb start-server >/dev/null
SERIALS="$(adb devices -l | awk 'NR>1 && $2=="device" {print $1}')"
COUNT="$(printf '%s\n' "$SERIALS" | sed '/^$/d' | wc -l | tr -d ' ')"
test "$COUNT" -eq 1
SERIAL="$(printf '%s\n' "$SERIALS" | sed -n '1p')"
MODEL="$(adb -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
test "$MODEL" = "$EXPECTED_MODEL"

SDK_ROOT=""
if [ -d "$HOME/Library/Android/sdk/platforms" ] && [ -x "$HOME/Library/Android/sdk/platform-tools/adb" ]; then
  SDK_ROOT="$HOME/Library/Android/sdk"
else
  ADB_REAL="$(python3 - "$(command -v adb)" <<'PY'
import os,sys
print(os.path.realpath(sys.argv[1]))
PY
)"
  CAND="$(cd "$(dirname "$ADB_REAL")/.." && pwd -P)"
  if [ -d "$CAND/platforms" ] && [ -d "$CAND/build-tools" ]; then SDK_ROOT="$CAND"; fi
fi
test -n "$SDK_ROOT"
export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"
printf 'sdk.dir=%s\n' "$SDK_ROOT" > apps/mobile/android/local.properties

pnpm --filter @lcl/mobile build
(
  cd apps/mobile
  pnpm exec cap sync android
  cd android
  ./gradlew assembleDebug
)
test -f "$APK"
adb -s "$SERIAL" install -r "$APK" >/dev/null
adb -s "$SERIAL" shell am force-stop "$APP_ID"
adb -s "$SERIAL" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 2
test -n "$(adb -s "$SERIAL" shell pm path "$APP_ID" | tr -d '\r')"
test "$(git rev-parse HEAD)" = "$CANDIDATE"
test -z "$(git status --porcelain)"
echo INSTALLED_CANDIDATE_SHA=$CANDIDATE
echo ANDROID_DEVICE_MODEL=$MODEL
echo STAGE7_ANDROID_INSTALL=1

# Reuse the verified CDP helper from Stage 5.
git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/capture-stage5-major-screens-cdp-20260912.sh > "$TMP_DIR/source.sh"
python3 - "$TMP_DIR/source.sh" "$TMP_DIR/cdp.mjs" <<'PY'
import sys
source=open(sys.argv[1], encoding='utf-8').read()
marker="cat > \"$TMP_DIR/cdp.mjs\" <<'JS'\n"
body=source.split(marker,1)[1].split('\nJS\n',1)[0]
open(sys.argv[2],'w',encoding='utf-8').write(body+'\n')
PY

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
cdp() { node "$TMP_DIR/cdp.mjs" "$WS_URL" "$@"; }
wait_selector() { cdp wait-selector "$1" >/dev/null; }
click_selector() { cdp click-selector "$1" "${2:-0}" >/dev/null; sleep 0.55; }
click_text() { cdp click-text "$1" >/dev/null; sleep 0.55; }
capture() {
  name="$1"
  cdp dump > "$TMP_DIR/$name.json"
  adb -s "$SERIAL" exec-out screencap -p > "$TMP_DIR/$name.png"
  sips -Z 780 -s format jpeg -s formatOptions 68 "$TMP_DIR/$name.png" --out "$TMP_DIR/$name-thumb.jpg" >/dev/null
  test -s "$TMP_DIR/$name-thumb.jpg"
}

wait_selector '.dashboard-shell'
click_selector '[data-dashboard-kind="climate"]'
wait_selector '.dashboard-shell'
click_selector '.dashboard-fab'
wait_selector '.intent-shell'
capture climate-add-intent
click_text 'Anuluj'
wait_selector '.dashboard-shell'
click_selector '[data-dashboard-kind="time"]'
wait_selector '.dashboard-shell'
click_selector '.dashboard-fab'
wait_selector '.hardware-shell'
capture time-add-direct
click_selector '.setup-context__back'
wait_selector '.dashboard-shell'
capture time-back-dashboard

python3 - "$TMP_DIR/climate-add-intent.json" "$TMP_DIR/time-add-direct.json" "$TMP_DIR/time-back-dashboard.json" <<'PY'
import json,sys
climate,time_setup,time_back=[json.load(open(p,encoding='utf-8')) for p in sys.argv[1:]]
assert 'Sterować temperaturą' in climate['bodyText'], climate['bodyText']
assert 'Sterować wilgotnością' in climate['bodyText'], climate['bodyText']
assert 'Sterować według czasu' not in climate['bodyText'], climate['bodyText']
assert 'Co chcesz zrobić?' not in time_setup['bodyText'], time_setup['bodyText']
assert 'Sterowanie według czasu' in time_setup['bodyText'], time_setup['bodyText']
assert 'Harmonogram' in time_setup['bodyText'], time_setup['bodyText']
time_nav=[e for e in time_back['elements'] if e.get('text')=='Czas' and e.get('ariaCurrent')=='page']
assert time_nav, time_back['elements']
print('STAGE7_DOM_AUDIT=1')
print('CLIMATE_INTENT_ONLY=1')
print('TIME_ADD_DIRECT=1')
print('TIME_BACK_RETURNS_TIME_DASHBOARD=1')
PY

printf 'MODEL=%s\nCANDIDATE=%s\nAPP_PID=%s\nSOCKET=%s\nWS_URL=%s\n' "$MODEL" "$CANDIDATE" "$PID" "$SOCKET" "$WS_URL" > "$TMP_DIR/meta.txt"
adb -s "$SERIAL" shell wm size >> "$TMP_DIR/meta.txt"
adb -s "$SERIAL" shell wm density >> "$TMP_DIR/meta.txt"

git fetch origin agent-control >/dev/null
git worktree add --detach "$CONTROL_DIR" origin/agent-control >/dev/null
mkdir -p "$CONTROL_DIR/$ARTIFACT_DIR"
cp "$TMP_DIR"/*.json "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR"/*-thumb.jpg "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR/meta.txt" "$CONTROL_DIR/$ARTIFACT_DIR/meta.txt"
(
  cd "$CONTROL_DIR"
  git add "$ARTIFACT_DIR"
  git commit -m "Capture Stage 7 contextual add audit" >/dev/null
  if ! git push origin HEAD:agent-control >/dev/null 2>&1; then
    git fetch origin agent-control >/dev/null
    git rebase origin/agent-control >/dev/null
    git push origin HEAD:agent-control >/dev/null
  fi
  echo AUDIT_CONTROL_SHA=$(git rev-parse HEAD)
)

echo STAGE7_CONTEXTUAL_ADD_AUDIT=1
