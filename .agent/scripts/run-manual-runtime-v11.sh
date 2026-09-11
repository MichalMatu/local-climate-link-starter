#!/bin/sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-manual-runtime-v9.sh > /tmp/run-manual-runtime-v11-expanded.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-manual-runtime-v11-expanded.sh')
s = p.read_text()
needle = "pnpm exec prettier --write \\\n"
patch = r'''python3 - <<'PY2'
from pathlib import Path

# Runtime mode now lives only in R.m and is read through Script.Eval, so keep
# the compact-runtime assertion aligned with that architecture.
p = Path('packages/script-generator/src/__tests__/manual-runtime.test.ts')
s = p.read_text()
s = s.replace(
    "keeps runtime control compact and uses diagnostics as the mode source of truth",
    "keeps runtime control compact and exposes mode through runtime state",
    1,
)
old = "    expect(script).toContain('md:0');\n    expect(script).toContain('md:R.m');\n"
new = "    expect(script).toContain('m:0');\n    expect(script).not.toContain('md:');\n"
if old not in s:
    raise SystemExit('v11 could not locate obsolete diagnostics-mode assertions')
p.write_text(s.replace(old, new, 1))

# Keep the Xiaomi runtime under the existing 4500-byte budget without relaxing
# it. Switch.Set is emitted three times in the MANUAL-safe output boundary; a
# tiny shared helper removes repetition while preserving the exact call order
# and the corrective OFF for an AUTO command that completes after MANUAL wins.
p = Path('packages/script-generator/src/shelly/generate.ts')
s = p.read_text()
old = 'function sw(o,rs,f){if(R.m)return;var n=nw(),ch=R.on!=o;if(o&&!f&&ch&&n-R.lc<C.c){R.rs="mc";return;}Shelly.call("Switch.Set",{id:C.i,on:o},function(r,e){if(R.m)return Shelly.call("Switch.Set",{id:C.i,on:false});if(e){R.rs="se";Shelly.call("Switch.Set",{id:C.i,on:false});R.on=false;return;}R.on=o;R.rs=rs;if(ch)R.lc=n;R.os=o?n:null;});}'
new = 'function s(o,c){Shelly.call("Switch.Set",{id:C.i,on:o},c)}\nfunction sw(o,q,f){if(R.m)return;var n=nw(),c=R.on!=o;if(o&&!f&&c&&n-R.lc<C.c){R.rs="mc";return;}s(o,function(r,e){if(R.m)return s(false);if(e){R.rs="se";s(false);R.on=false;return;}R.on=o;R.rs=q;if(c)R.lc=n;R.os=o?n:null;});}'
if s.count(old) != 1:
    raise SystemExit(f'v11 expected one MANUAL-safe sw(), found {s.count(old)}')
p.write_text(s.replace(old, new, 1))
PY2

'''
if needle not in s:
    raise SystemExit('v11 could not locate prettier stage in v9 runner')
s = s.replace(needle, patch + needle, 1)
s = s.replace('MANUAL_RUNTIME_V9_SHA=', 'MANUAL_RUNTIME_V11_SHA=', 1)
p.write_text(s)
PY
sh /tmp/run-manual-runtime-v11-expanded.sh
