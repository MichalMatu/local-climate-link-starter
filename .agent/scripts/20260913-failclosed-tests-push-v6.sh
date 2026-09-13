#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
BASE_REMOTE=fbbde9abb37fe9fcdbce5c7cdc8f3bdd98e3d895
FAILCLOSED=6876bbcf

cd "$REPO"
git fetch origin "$BRANCH" agent-control
REMOTE_HEAD=$(git rev-parse "origin/$BRANCH")
if [[ "$REMOTE_HEAD" != "$BASE_REMOTE" ]]; then
  echo "Remote branch moved unexpectedly: $REMOTE_HEAD"
  exit 2
fi
if ! git cat-file -e "${FAILCLOSED}^{commit}" 2>/dev/null; then
  echo "Missing local fail-closed commit $FAILCLOSED"
  exit 3
fi

git checkout "$BRANCH"
git reset --hard "$FAILCLOSED"
[[ -z "$(git status --porcelain)" ]] || { echo 'Checkout is not clean'; exit 4; }

python3 - <<'PY'
from pathlib import Path

p = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
s = p.read_text()
old = """    expect(screen.queryByText('brak reguły')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Najpierw zapisz regułę dla tego gniazdka.')
    ).not.toBeInTheDocument();

    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    const actionRow = within(savedPlugList).getByLabelText(/^Sterowanie /);
    const autoButton = within(actionRow).getByRole('button', { name: 'AUTO' });
    expect(autoButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(autoButton);
    await screen.findByText('Najpierw zapisz regułę dla tego gniazdka.');
    expect(
      within(savedPlugList).queryByText('Najpierw zapisz regułę dla tego gniazdka.')
    ).not.toBeInTheDocument();

    const rpcMethods = vi
"""
new = """    expect(screen.queryByText('brak reguły')).not.toBeInTheDocument();

    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    const actionRow = within(savedPlugList).getByLabelText(/^Sterowanie /);
    const autoButton = within(actionRow).getByRole('button', { name: 'AUTO' });
    const manualButton = within(actionRow).getByRole('button', { name: 'MANUAL' });
    expect(autoButton).toHaveAttribute('aria-pressed', 'false');
    expect(autoButton).toBeDisabled();
    expect(manualButton).toBeDisabled();

    const rpcMethods = vi
"""
if old not in s:
    raise SystemExit('hardware setup assertion block not found')
s = s.replace(old, new)
p.write_text(s)

p = Path('packages/automation-core/src/__tests__/schedule.test.ts')
s = p.read_text()
needle = "  it('evaluates same-day and cross-midnight windows using the starting weekday', () => {"
insert = """  it('fails closed for malformed clock input and invalid windows', () => {\n    expect(\n      isRuleScheduleActive(\n        { windows: [{ days: [1], start: '08:00', end: '10:00' }] },\n        1,\n        'not-a-time'\n      )\n    ).toBe(false);\n    expect(\n      isRuleScheduleActive(\n        { windows: [{ days: [1], start: 'bad', end: '10:00' }] },\n        1,\n        '09:00'\n      )\n    ).toBe(false);\n    expect(\n      isRuleScheduleActive(\n        { windows: [{ days: [1], start: '08:00', end: 'bad' }] },\n        1,\n        '09:00'\n      )\n    ).toBe(false);\n    expect(\n      isRuleScheduleActive(\n        { windows: [{ days: [1], start: '08:00', end: '08:00' }] },\n        1,\n        '08:00'\n      )\n    ).toBe(false);\n  });\n\n"""
if needle not in s:
    raise SystemExit('schedule test anchor missing')
if 'fails closed for malformed clock input and invalid windows' not in s:
    s = s.replace(needle, insert + needle)
p.write_text(s)
PY

pnpm exec prettier --write apps/mobile/src/__tests__/hardware-setup.test.tsx packages/automation-core/src/__tests__/schedule.test.ts
pnpm --filter @lcl/automation-core test:coverage
pnpm --filter @lcl/mobile test
pnpm --filter @lcl/mobile typecheck
pnpm quality:repo
pnpm quality:ux

git add apps/mobile/src/__tests__/hardware-setup.test.tsx packages/automation-core/src/__tests__/schedule.test.ts
[[ -n "$(git diff --cached --name-only)" ]] || { echo 'No test changes to commit'; exit 5; }
git commit -m 'Cover fail-closed runtime and schedule branches'
NEW_HEAD=$(git rev-parse HEAD)
PARENT=$(git rev-parse HEAD^)
[[ "$PARENT" == "$(git rev-parse "$FAILCLOSED")" ]] || { echo "Unexpected parent $PARENT"; exit 6; }

git push origin "HEAD:$BRANCH"
git fetch origin "$BRANCH"
PUSHED=$(git rev-parse "origin/$BRANCH")
[[ "$PUSHED" == "$NEW_HEAD" ]] || { echo "Push verification failed: local=$NEW_HEAD remote=$PUSHED"; exit 7; }
printf 'PUSHED_HEAD=%s\n' "$PUSHED"
