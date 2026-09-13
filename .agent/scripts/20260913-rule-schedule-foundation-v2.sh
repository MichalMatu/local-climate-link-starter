#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='70c8fb0e989200479a05e57516ad12fbe763b8d5'

git fetch --prune origin "$BRANCH" agent-control
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
test -z "$(git status --porcelain)"

git show origin/agent-control:.agent/scripts/20260913-rule-schedule-foundation.sh > /tmp/lcl-rule-schedule-foundation-v1.sh
set +e
bash /tmp/lcl-rule-schedule-foundation-v1.sh
BASE_STATUS=$?
set -e
test "$BASE_STATUS" -ne 0
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"

python3 - <<'PY'
from pathlib import Path

p = Path('packages/script-generator/src/shelly/generate.ts')
s = p.read_text()
start = s.index('const createRuntimeConfig = (')
end = s.index('\n\nconst renderThresholdHelper', start)
replacement = '''const createRuntimeConfig = (config: ShellyThermostatConfig, hash: string) => {\n  const base = {\n    a: compactAddress(config.sensor.runtimeAddress),\n    fa: config.sensor.runtimeAddress,\n    n: config.sensor.displayName,\n    k: hash,\n    i: config.output.relayId,\n    r: config.rule.rssiMin,\n    on: config.rule.control.onThreshold,\n    off: config.rule.control.offThreshold,\n    d: config.rule.control.direction === 'above' ? 1 : 0,\n    m: config.rule.control.metric === 'humidity' ? 1 : 0,\n    h: config.rule.consecutiveHits,\n    c: config.rule.minChangeMs,\n    s: config.rule.staleTimeoutSec * 1000,\n    x: config.rule.maxOnMs,\n    v: config.version,\n    vp: config.rule.vpdAssist.enabled ? config.rule.vpdAssist.targetKpa : 0\n  };\n\n  if (!config.schedule) return base;\n  return {\n    ...base,\n    tw: config.schedule.windows.map((window) => {\n      const start = parseRuleClockMinutes(window.start);\n      const end = parseRuleClockMinutes(window.end);\n      if (start === null || end === null) {\n        throw new Error('Validated rule schedule contains an invalid clock time.');\n      }\n      return [window.days, start, end];\n    })\n  };\n};'''
s = s[:start] + replacement + s[end:]
old = "  if (!config.schedule) return 'function aw(){return 1;}';"
new = "  if (!config.schedule) return '';"
assert s.count(old) == 1
s = s.replace(old, new)
old = '''const renderMeasurementHelper = (config: ShellyThermostatConfig): string => {\n  const commonDecision =\n    'var W=aw();if(!R.m&&W<=0){R.ds=W<0?"nt":"tw";sw(false,W<0?"nt":"tw",true);return;}R.ds="ok";var T=th(t,h);R.eo=T.o;R.ef=T.f;R.vp=C.vp?vd(t,h):null;var go=C.d?v>T.o:v<T.o,stop=C.d?v<T.f:v>T.f,gr=C.d?"ab":"bl",sr=C.d?"bl":"ab";if(go){R.nh++;R.fh=0;if(R.nh<C.h){sw(R.on,gr+"h",false);return;}sw(true,gr,false);return;}if(stop){R.fh++;R.nh=0;sw(false,sr,false);return;}R.nh=0;R.fh=0;sw(R.on,"ib",false);';'''
new = '''const renderMeasurementHelper = (config: ShellyThermostatConfig): string => {\n  const scheduleGuard = config.schedule\n    ? 'var W=aw();if(!R.m&&W<=0){R.ds=W<0?"nt":"tw";sw(false,W<0?"nt":"tw",true);return;}'\n    : '';\n  const commonDecision =\n    scheduleGuard +\n    'R.ds="ok";var T=th(t,h);R.eo=T.o;R.ef=T.f;R.vp=C.vp?vd(t,h):null;var go=C.d?v>T.o:v<T.o,stop=C.d?v<T.f:v>T.f,gr=C.d?"ab":"bl",sr=C.d?"bl":"ab";if(go){R.nh++;R.fh=0;if(R.nh<C.h){sw(R.on,gr+"h",false);return;}sw(true,gr,false);return;}if(stop){R.fh++;R.nh=0;sw(false,sr,false);return;}R.nh=0;R.fh=0;sw(R.on,"ib",false);';'''
assert s.count(old) == 1
s = s.replace(old, new)
old = 'function stale(){var W=aw();if(!R.m&&W<=0){R.ds=W<0?"nt":"tw";R.nh=0;R.fh=0;sw(false,W<0?"nt":"tw",true);return;}var n=nw();if(R.ls===null||n-R.ls>C.s){R.ds="st";R.nh=0;R.fh=0;sw(false,"st",true);return;}if(R.on&&R.os!==null&&n-R.os>=C.x){R.nh=0;R.fh=0;sw(false,"mx",true);}}'
new = 'function stale(){${config.schedule ? \'var W=aw();if(!R.m&&W<=0){R.ds=W<0?"nt":"tw";R.nh=0;R.fh=0;sw(false,W<0?"nt":"tw",true);return;}\' : \'\'}var n=nw();if(R.ls===null||n-R.ls>C.s){R.ds="st";R.nh=0;R.fh=0;sw(false,"st",true);return;}if(R.on&&R.os!==null&&n-R.os>=C.x){R.nh=0;R.fh=0;sw(false,"mx",true);}}'
assert s.count(old) == 1
s = s.replace(old, new)
p.write_text(s)

p = Path('packages/script-generator/src/__tests__/schedule.test.ts')
s = p.read_text()
old = '''    expect(script).toContain('"tw":null');\n    expect(script).toContain('function aw(){return 1;}');'''
new = '''    expect(script).not.toContain('"tw":');\n    expect(script).not.toContain('function aw()');'''
assert s.count(old) == 1
p.write_text(s.replace(old, new))
PY

pnpm exec prettier --write packages/script-generator/src/shelly/generate.ts packages/script-generator/src/__tests__/schedule.test.ts

pnpm --filter @lcl/script-generator exec vitest run src/__tests__/generator.test.ts -u
pnpm --filter @lcl/automation-core test
pnpm --filter @lcl/script-generator test
pnpm --filter @lcl/mobile test -- src/flows/registry/devicesAndRules.test.ts src/flows/rules/ownership.test.ts
pnpm --filter @lcl/mobile typecheck
pnpm quality:repo

git diff --check
git status --short
git diff --stat

git add \
  packages/automation-core/src/schedule.ts \
  packages/automation-core/src/__tests__/schedule.test.ts \
  packages/automation-core/src/index.ts \
  apps/mobile/src/flows/rules/model.ts \
  apps/mobile/src/flows/rules/selectors.ts \
  apps/mobile/src/flows/rules/store.ts \
  apps/mobile/src/flows/registry/fixtures.test-support.ts \
  apps/mobile/src/flows/registry/devicesAndRules.test.ts \
  packages/script-generator/src/shelly/config.ts \
  packages/script-generator/src/shelly/generate.ts \
  packages/script-generator/src/__tests__/schedule.test.ts \
  packages/script-generator/src/__tests__/__snapshots__/generator.test.ts.snap

git commit -m 'Add rule schedule foundation'
printf 'FINAL_HEAD=%s\n' "$(git rev-parse HEAD)"
test -z "$(git status --porcelain)"
