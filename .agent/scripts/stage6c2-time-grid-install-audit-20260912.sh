#!/usr/bin/env sh
set -eu

TMP="$(mktemp /tmp/lcl-stage6c2.XXXXXX.sh)"
cleanup() { rm -f "$TMP"; }
trap cleanup EXIT INT TERM

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/stage6c-time-grid-install-audit-20260912.sh > "$TMP"

python3 - "$TMP" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
s=p.read_text(encoding='utf-8')
old="""python3 - <<'PY'\nfrom pathlib import Path\np=Path('apps/mobile/src/theme/theme.css')\ns=p.read_text(encoding='utf-8')\nold='minmax(min(100%, var(--lcl-size-form-column-min)), 1fr)'\nnew='minmax(min(100%, 8rem), 1fr)'\ncount=s.count(old)\nassert count == 2, f'expected 2 time-grid min patterns, got {count}'\ns=s.replace(old,new)\np.write_text(s,encoding='utf-8')\nPY\n"""
new="""python3 - <<'PY'\nfrom pathlib import Path\np=Path('apps/mobile/src/theme/theme.css')\ns=p.read_text(encoding='utf-8')\nold_main='''.time-schedule-grid {\n  display: grid;\n  gap: var(--lcl-spacing-md);\n  grid-template-columns: repeat(\n    auto-fit,\n    minmax(min(100%, var(--lcl-size-form-column-min)), 1fr)\n  );\n}'''\nnew_main='''.time-schedule-grid {\n  display: grid;\n  gap: var(--lcl-spacing-md);\n  grid-template-columns: repeat(\n    auto-fit,\n    minmax(min(100%, 8rem), 1fr)\n  );\n}'''\nold_detail='''.installation-detail-config .time-schedule-grid {\n  grid-template-columns: repeat(\n    auto-fit,\n    minmax(min(100%, var(--lcl-size-form-column-min)), 1fr)\n  );\n}'''\nnew_detail='''.installation-detail-config .time-schedule-grid {\n  grid-template-columns: repeat(\n    auto-fit,\n    minmax(min(100%, 8rem), 1fr)\n  );\n}'''\nassert s.count(old_main) == 1, 'primary time schedule grid block mismatch'\nassert s.count(old_detail) == 1, 'installation detail time schedule grid block mismatch'\ns=s.replace(old_main,new_main,1).replace(old_detail,new_detail,1)\np.write_text(s,encoding='utf-8')\nPY\n"""
assert old in s, 'Stage 6C edit stanza not found'
p.write_text(s.replace(old,new,1),encoding='utf-8')
PY

sh "$TMP"
