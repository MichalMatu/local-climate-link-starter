#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-shelly-ux-polish-stage3-green-20260911.sh > /tmp/run-shelly-ux-polish-stage3-green-v2-inner.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-shelly-ux-polish-stage3-green-v2-inner.sh')
s = p.read_text()
old = "    expect(within(infoDialog).getByText('http://192.168.0.20/')).toBeInTheDocument();"
new = """    expect(
      within(infoDialog).getByRole('link', {
        name: 'Otwórz panel Shelly: http://192.168.0.20/'
      })
    ).toBeInTheDocument();"""
count = s.count(old)
if count != 1:
    raise SystemExit(f'expected one ambiguous URL assertion, got {count}')
p.write_text(s.replace(old, new, 1))
PY
sh /tmp/run-shelly-ux-polish-stage3-green-v2-inner.sh
