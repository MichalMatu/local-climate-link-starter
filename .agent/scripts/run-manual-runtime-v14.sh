#!/bin/sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-manual-runtime-v13.sh > /tmp/run-manual-runtime-v14-expanded.sh

python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-manual-runtime-v14-expanded.sh')
s = p.read_text()
marker = '# Extend the existing diagnostics integration fixture with realistic direct-RPC'
start = s.index(marker)
block_start = s.index(
    'replace_once(\n    hardware_test,\n    "    await waitFor(() => expect(screen.getAllByText(\'69.6%\')).toHaveLength(2));\\n",',
    start,
)
block_end_marker = '\n)\n\n# Architecture documentation'
block_end = s.index(block_end_marker, block_start) + 3
new_block = '''replace_once(
    hardware_test,
    "    expect(screen.getAllByText('OFF').length).toBeGreaterThanOrEqual(2);\\n  });\\n\\n  it('shows a neutral BLE data state when a helper packet follows a valid rule value', async () => {",
    "    expect(screen.getAllByText('OFF').length).toBeGreaterThanOrEqual(2);\\n    await waitFor(() =>\\n      expect(screen.getByText('Stan skryptu RPC').closest('.lcl-diagnostic-row')).toHaveTextContent('RUNNING')\\n    );\\n    expect(screen.getByText('JS użyte teraz').closest('.lcl-diagnostic-row')).toHaveTextContent('12.0 KiB');\\n    expect(screen.getByText('JS peak').closest('.lcl-diagnostic-row')).toHaveTextContent('16.0 KiB');\\n    expect(screen.getByText('JS wolne').closest('.lcl-diagnostic-row')).toHaveTextContent('24.5 KiB');\\n    expect(screen.getByText('CPU skryptu').closest('.lcl-diagnostic-row')).toHaveTextContent('0.3%');\\n    expect(screen.getByText('RAM Shelly wolny').closest('.lcl-diagnostic-row')).toHaveTextContent('93.9 KiB');\\n    expect(screen.getByText('RAM Shelly razem').closest('.lcl-diagnostic-row')).toHaveTextContent('253.1 KiB');\\n  });\\n\\n  it('shows a neutral BLE data state when a helper packet follows a valid rule value', async () => {",
)'''
s = s[:block_start] + new_block + s[block_end:]
s = s.replace("'MANUAL_RUNTIME_V9_SHA=', 'MANUAL_RUNTIME_V13_SHA='", "'MANUAL_RUNTIME_V9_SHA=', 'MANUAL_RUNTIME_V14_SHA='", 1)
p.write_text(s)
PY

sh /tmp/run-manual-runtime-v14-expanded.sh
