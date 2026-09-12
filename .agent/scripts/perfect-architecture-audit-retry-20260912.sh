#!/usr/bin/env bash
set -euo pipefail

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/perfect-architecture-audit-20260912.sh > /tmp/lcl-perfect-architecture-audit-base.sh
python3 - /tmp/lcl-perfect-architecture-audit-base.sh /tmp/lcl-perfect-architecture-audit-fixed.sh <<'PY'
from pathlib import Path
import sys
src=Path(sys.argv[1]).read_text()
src=src.replace(
    '  rm -rf "$TMP" "$CONTROL"\n',
    '  [ -z "${ANALYZER:-}" ] || rm -f "$ANALYZER"\n  rm -rf "$TMP" "$CONTROL"\n',
    1,
)
src=src.replace(
    'cat >"$TMP/analyze.mjs" <<\'JS\'\n',
    'ANALYZER="$ROOT/.lcl-architecture-audit-analyze.mjs"\ncat >"$ANALYZER" <<\'JS\'\n',
    1,
)
src=src.replace(
    'node "$TMP/analyze.mjs" "$TMP/metrics.json"\n',
    'node "$ANALYZER" "$TMP/metrics.json"\nrm -f "$ANALYZER"\n',
    1,
)
if '$TMP/analyze.mjs' in src:
    raise SystemExit('failed to patch analyzer path completely')
Path(sys.argv[2]).write_text(src)
PY
bash /tmp/lcl-perfect-architecture-audit-fixed.sh