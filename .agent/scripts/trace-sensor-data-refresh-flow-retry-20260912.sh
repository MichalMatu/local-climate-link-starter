#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/trace-sensor-data-refresh-flow-20260912.sh > /tmp/lcl-sensor-refresh-retry.sh
python3 - /tmp/lcl-sensor-refresh-retry.sh <<'PY'
from pathlib import Path
p=Path('/tmp/lcl-sensor-refresh-retry.sh')
s=p.read_text()
old="""click_selector '.setup-top-nav__item' 0
wait_selector '.shelly-setup-panel'
dump_named shelly-tab-entered
"""
new="""click_selector '.setup-top-nav__item' 0
sleep 0.3
ACTIVE_INDEX=\"$(cdp eval \"Array.from(document.querySelectorAll('.setup-top-nav__item')).findIndex((el) => el.classList.contains('setup-top-nav__item--active'))\")\"
test \"$ACTIVE_INDEX\" = \"0\"
wait_selector '.setup-add-fab'
dump_named shelly-tab-entered
"""
if s.count(old) != 1:
    raise SystemExit(f'expected one selector block, found {s.count(old)}')
p.write_text(s.replace(old,new))
PY
sh /tmp/lcl-sensor-refresh-retry.sh
