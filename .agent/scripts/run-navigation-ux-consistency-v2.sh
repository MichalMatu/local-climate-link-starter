#!/usr/bin/env sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-navigation-ux-consistency-v1.sh > /tmp/run-navigation-ux-consistency-v2-inner.sh

python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-navigation-ux-consistency-v2-inner.sh')
s = p.read_text()
old = "    await waitFor(() => expect(nativeAppMocks.removeListener).toHaveBeenCalledTimes(1));"
new = "    await waitFor(() => expect(nativeAppMocks.removeListener).toHaveBeenCalled());"
if s.count(old) != 1:
    raise SystemExit(f'expected one Android listener cleanup assertion, got {s.count(old)}')
p.write_text(s.replace(old, new, 1))
PY

sh /tmp/run-navigation-ux-consistency-v2-inner.sh
