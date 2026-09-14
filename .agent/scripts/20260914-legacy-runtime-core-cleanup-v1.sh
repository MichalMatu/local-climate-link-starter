#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=2258a0607d4476659cb855dc14546b1b5d2b955f
cd "$REPO"

git fetch origin "$BRANCH" agent-control
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
[[ "$(git rev-parse HEAD)" == "$EXPECTED" ]] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

python3 - <<'PY'
from pathlib import Path

ownership = Path('apps/mobile/src/flows/rules/ownership.ts')
text = ownership.read_text()
old = "import { scheduleJobControlsRelay } from '../time-automation/scheduleOwnership.js';"
new = "import { scheduleJobControlsRelay } from './scheduleOwnership.js';"
if old not in text:
    raise SystemExit('Expected legacy schedule ownership import not found')
ownership.write_text(text.replace(old, new, 1))

control = Path('apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts')
text = control.read_text()
old = "import { forceRelayOffAndConfirm } from '../installations/relaySafety.js';"
new = "import { forceRelayOffAndConfirm } from '../runtime/relaySafety.js';"
if old not in text:
    raise SystemExit('Expected legacy relay safety import not found')
control.write_text(text.replace(old, new, 1))

nav_test = Path('apps/mobile/src/__tests__/navigation-settings-regression.test.tsx')
nav_test.write_text("""import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app/App.js';
import { setLocalePreference } from '../app/i18n.js';
import { setThemeMode } from '../app/themeMode.js';

vi.mock('../screens/AutomationDashboardScreen.js', () => ({
  AutomationDashboardScreen: ({
    onAddAutomation,
    onOpenSettings
  }: {
    onAddAutomation(): void;
    onOpenSettings?: () => void;
  }) => (
    <main>
      <h1>dashboard-test</h1>
      <button type=\"button\" onClick={onAddAutomation}>
        add-automation-test
      </button>
      <button type=\"button\" onClick={onOpenSettings}>
        Ustawienia aplikacji
      </button>
    </main>
  )
}));

describe('navigation and settings regression coverage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocalePreference('pl');
    setThemeMode('system');
  });

  afterEach(() => {
    cleanup();
    setLocalePreference('system');
    setThemeMode('system');
    window.localStorage.clear();
  });

  it('returns visibly from Add automation to the dashboard', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'dashboard-test' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'add-automation-test' }));
    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));
    expect(screen.getByRole('heading', { name: 'dashboard-test' })).toBeVisible();
  });
});
""")
PY

cat > apps/mobile/src/flows/rules/scheduleOwnership.ts <<'EOF'
import type { ShellyScheduleJob } from '@lcl/shelly-client';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const scheduleJobControlsRelay = (
  job: ShellyScheduleJob,
  relayId: number
): boolean =>
  job.calls.some((call) => {
    if (call.method !== 'Switch.Set' || !isRecord(call.params)) {
      return false;
    }
    return call.params.id === relayId;
  });
EOF

rm -rf apps/mobile/src/flows/installations
rm -rf apps/mobile/src/flows/time-automation
rm -f apps/mobile/src/app/locales/installationHealth.ts
rm -f apps/mobile/src/__tests__/script-preview.test.ts

pnpm exec prettier --write \
  apps/mobile/src/flows/rules/ownership.ts \
  apps/mobile/src/flows/rules/scheduleOwnership.ts \
  apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts \
  apps/mobile/src/__tests__/navigation-settings-regression.test.tsx

[[ ! -d apps/mobile/src/flows/installations ]]
[[ ! -d apps/mobile/src/flows/time-automation ]]
grep -q "from './scheduleOwnership.js'" apps/mobile/src/flows/rules/ownership.ts
grep -q "from '../runtime/relaySafety.js'" apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts
! git grep -nE 'InstalledAutomation|createInstalledAutomation|useInstalledAutomationStore|time-automation|../installations' -- apps/mobile/src

pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run \
  src/__tests__/navigation-settings-regression.test.tsx \
  src/__tests__/app-routes.test.tsx
pnpm lint
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile build

git add -A
git diff --cached --check
pnpm precommit

git commit -m "Remove legacy automation runtime"

git fetch origin "$BRANCH"
[[ "$(git rev-parse origin/$BRANCH)" == "$EXPECTED" ]] || { echo "Remote branch moved before push"; exit 4; }
git push origin HEAD:"$BRANCH"
git fetch origin "$BRANCH"
FINAL_HEAD=$(git rev-parse HEAD)
[[ "$FINAL_HEAD" == "$(git rev-parse origin/$BRANCH)" ]] || { echo 'Push verification failed'; exit 5; }
echo "FINAL_HEAD=$FINAL_HEAD"
