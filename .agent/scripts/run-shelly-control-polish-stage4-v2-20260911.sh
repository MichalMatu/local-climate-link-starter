#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-shelly-control-polish-stage4-20260911.sh > /tmp/shelly-stage4-v2-inner.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/shelly-stage4-v2-inner.sh')
s = p.read_text()
marker = "pnpm exec prettier --write \\\n"
if s.count(marker) != 1:
    raise SystemExit(f'prettier marker mismatch: {s.count(marker)}')
patch = r'''python3 - <<'PYFIX'
from pathlib import Path
p = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
s = p.read_text()

def once(old: str, new: str, label: str):
    global s
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    s = s.replace(old, new, 1)

once(
"""    expect(within(infoDialog).getByText('Bluetooth')).toBeInTheDocument();
    expect(within(savedPlugList).getByText('Przekaźnik')).toBeInTheDocument();""",
"""    expect(within(infoDialog).getByText('Bluetooth')).toBeInTheDocument();
    expect(within(infoDialog).getByText('Przekaźnik')).toBeInTheDocument();
    expect(within(infoDialog).getByText('Tryb')).toBeInTheDocument();""",
'compatibility info state rows'
)

once(
"""    const autoButton = within(actionRow).getByRole('button', { name: 'AUTO' });
    expect(autoButton).toHaveClass('automation-toggle--missing');""",
"""    const autoButton = within(actionRow).getByRole('button', { name: 'AUTO' });
    expect(autoButton).toHaveAttribute('aria-pressed', 'false');""",
'missing rule segmented control'
)

old_click = """    fireEvent.click(within(actionRow).getByRole('button', { name: 'ON' }));
    expect(await screen.findByText('Przekaźnik ON.')).toBeInTheDocument();"""
new_click = """    const manualRelayButton = within(actionRow).getByRole('button', { name: 'MANUAL' });
    if (manualRelayButton.getAttribute('aria-pressed') !== 'true') {
      fireEvent.click(manualRelayButton);
      await screen.findByText('Tryb MANUAL. Przekaźnik OFF.');
    }
    fireEvent.click(within(actionRow).getByRole('button', { name: 'ON' }));
    expect(await screen.findByText('Przekaźnik ON.')).toBeInTheDocument();"""
count = s.count(old_click)
if count < 1:
    raise SystemExit('expected at least one direct ON/toast pattern')
s = s.replace(old_click, new_click)

p.write_text(s)
PYFIX

'''
s = s.replace(marker, patch + marker, 1)
p.write_text(s)
PY
sh /tmp/shelly-stage4-v2-inner.sh
