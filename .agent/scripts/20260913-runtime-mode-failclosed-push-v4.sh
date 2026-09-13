#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_REMOTE='fbbde9abb37fe9fcdbce5c7cdc8f3bdd98e3d895'
CANDIDATE='6876bbcf659a952be90c9f3a0968d3d5ab414cf5'
git fetch origin "$BRANCH" agent-control
REMOTE_HEAD="$(git rev-parse "origin/$BRANCH")"
[ "$REMOTE_HEAD" = "$EXPECTED_REMOTE" ] || { echo "Remote head changed: $REMOTE_HEAD" >&2; exit 1; }
git reset --hard "$CANDIDATE"
git checkout -B "$BRANCH" "$CANDIDATE"
python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
s=p.read_text()
old='''    expect(screen.queryByText('brak reguły')).not.toBeInTheDocument();\n    expect(\n      screen.queryByText('Najpierw zapisz regułę dla tego gniazdka.')\n    ).not.toBeInTheDocument();\n\n    const savedPlugList = screen.getByLabelText('Dodane gniazdka');\n    const actionRow = within(savedPlugList).getByLabelText(/^Sterowanie /);\n    const autoButton = within(actionRow).getByRole('button', { name: 'AUTO' });\n    expect(autoButton).toHaveAttribute('aria-pressed', 'false');\n\n    fireEvent.click(autoButton);\n    await screen.findByText('Najpierw zapisz regułę dla tego gniazdka.');\n    expect(\n      within(savedPlugList).queryByText('Najpierw zapisz regułę dla tego gniazdka.')\n    ).not.toBeInTheDocument();\n\n    const rpcMethods = vi\n'''
new='''    expect(screen.queryByText('brak reguły')).not.toBeInTheDocument();\n    expect(\n      screen.queryByText('Najpierw zapisz regułę dla tego gniazdka.')\n    ).not.toBeInTheDocument();\n\n    const savedPlugList = screen.getByLabelText('Dodane gniazdka');\n    const actionRow = within(savedPlugList).getByLabelText(/^Sterowanie /);\n    const autoButton = within(actionRow).getByRole('button', { name: 'AUTO' });\n    const manualButton = within(actionRow).getByRole('button', { name: 'MANUAL' });\n    expect(autoButton).toHaveAttribute('aria-pressed', 'false');\n    expect(autoButton).toBeDisabled();\n    expect(manualButton).toBeDisabled();\n\n    const rpcMethods = vi\n'''
if old not in s:
    raise SystemExit('legacy missing-rule test block not found')
s=s.replace(old,new,1)
s=s.replace("    expect(rpcMethods).not.toContain('Script.Start');\n", "    expect(rpcMethods).not.toContain('Script.Start');\n    expect(rpcMethods).not.toContain('Script.Eval');\n",1)
p.write_text(s)
PY
pnpm exec prettier --write apps/mobile/src/__tests__/hardware-setup.test.tsx
pnpm --filter @lcl/mobile test -- src/__tests__/hardware-setup.test.tsx
pnpm --filter @lcl/mobile typecheck
pnpm quality:repo
pnpm quality:ux
git add apps/mobile/src/__tests__/hardware-setup.test.tsx
git commit --amend --no-edit
FINAL_HEAD="$(git rev-parse HEAD)"
[ "$(git rev-parse HEAD^)" = "$EXPECTED_REMOTE" ] || { echo 'Amended parent mismatch' >&2; exit 1; }
git push origin "$FINAL_HEAD:refs/heads/$BRANCH"
echo "PUSHED_HEAD=$FINAL_HEAD"
