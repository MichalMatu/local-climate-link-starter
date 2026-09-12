#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=ded8d77605131b728d66b64a4aee66ce347c1eca

git fetch --prune origin "$BRANCH" agent-control
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
git checkout "$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"

# Continue the exact failed fix6 state. If runtime cleanup removed the worktree,
# deterministically reproduce fix6 up to its expected stale-test failure.
if test -z "$(git status --porcelain)"; then
  git show origin/agent-control:.agent/scripts/ux-modal-toast-polish-stage5-fix6-20260912.sh > /tmp/lcl-stage5-fix6.sh
  set +e
  sh /tmp/lcl-stage5-fix6.sh
  RC=$?
  set -e
  test "$RC" -eq 1
  test "$(git rev-parse HEAD)" = "$BASE"
fi

test -n "$(git status --porcelain)"
grep -q 'size="task"' apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
grep -q 'size="task"' apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx
! grep -q 'dismissShellyScanProgressToast' apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx

python3 <<'PY'
from pathlib import Path
import re

page = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
s = page.read_text()

# A scan result now selects/fills the form rather than directly adding a device.
# Keep the accessible name aligned with that behavior and localized via common.select.
pattern = re.compile(
    r"aria-label=\{t\('hardware\.shelly\.addAria',\s*\{\s*address: result\.baseUrl\s*\}\)\}",
    re.S,
)
s2, n = pattern.subn("aria-label={`${t('common.select')}: ${result.baseUrl}`}", s, count=1)
if n != 1:
    raise SystemExit(f'expected one scan-result addAria marker, got {n}')
page.write_text(s2)

test_path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
t = test_path.read_text()

# Replace the old standalone-scan/direct-add contract with the agreed single-task flow.
first_re = re.compile(
    r"  it\('scans the local network from a modal and directly adds a found Shelly', async \(\) => \{.*?\n  \}\);\n\n  it\('continues Shelly network scan past already saved plugs'",
    re.S,
)
first_new = """  it('scans the local network inside the add task and fills the form before adding', async () => {
    renderHardwareSetup();

    const dialog = await openShellyAddDialog();
    fireEvent.change(within(dialog).getByLabelText('Nazwa gniazdka'), {
      target: { value: 'Salon' }
    });
    expect(within(dialog).getByLabelText('Od')).toHaveValue('192.168.0.1');
    expect(within(dialog).getByLabelText('Do')).toHaveValue('192.168.0.99');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Rozpocznij skan' }));

    expect(await within(dialog).findByText('http://192.168.0.20/')).toBeInTheDocument();
    expect(within(dialog).getByText('S3PL-00112EU, gen 3')).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Wybierz: http://192.168.0.20/'
      })
    );

    expect(screen.getByRole('dialog', { name: 'Dodaj gniazdko' })).toBe(dialog);
    expect(within(dialog).getByLabelText('Nazwa gniazdka')).toHaveValue('Salon');
    expect(within(dialog).getByLabelText('Adres IP Shelly')).toHaveValue(
      'http://192.168.0.20/'
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Dodaj' }));

    expect(await screen.findByText('Dodano gniazdko.')).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })
    ).not.toBeInTheDocument();
    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    expect(within(savedPlugList).getByText('Salon')).toBeInTheDocument();
  });

  it('continues Shelly network scan past already saved plugs'"""
t, n = first_re.subn(first_new, t, count=1)
if n != 1:
    raise SystemExit(f'expected first Shelly scan test block, got {n}')

populate_re = re.compile(
    r"  it\('uses the scan result action to add the Shelly without reopening the form', async \(\) => \{.*?\n  \}\);\n\n  it\('stops an active Shelly scan from the modal button'",
    re.S,
)
populate_new = """  it('uses the scan result action to populate the add form before final add', async () => {
    renderHardwareSetup();

    const dialog = await openShellyAddDialog();
    fireEvent.change(within(dialog).getByLabelText('Nazwa gniazdka'), {
      target: { value: '' }
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rozpocznij skan' }));
    await within(dialog).findByText('http://192.168.0.20/');

    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Wybierz: http://192.168.0.20/'
      })
    );

    expect(screen.getByRole('dialog', { name: 'Dodaj gniazdko' })).toBe(dialog);
    expect(within(dialog).getByLabelText('Nazwa gniazdka')).toHaveValue('S3PL-00112EU');
    expect(within(dialog).getByLabelText('Adres IP Shelly')).toHaveValue(
      'http://192.168.0.20/'
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Dodaj' }));
    expect(
      await screen.findByRole('button', { name: 'Ustawienia gniazdka' })
    ).toBeInTheDocument();
  });

  it('stops an active Shelly scan from the inline task control'"""
t, n = populate_re.subn(populate_new, t, count=1)
if n != 1:
    raise SystemExit(f'expected scan-result test block, got {n}')

stop_re = re.compile(
    r"  it\('stops an active Shelly scan from the inline task control', async \(\) => \{.*?\n  \}\);\n\n  it\('stops an active Shelly scan when closing the modal'",
    re.S,
)
stop_new = """  it('stops an active Shelly scan from the inline task control', async () => {
    const abortableFetch = createAbortableFetchMock();
    vi.stubGlobal('fetch', abortableFetch.fetchImpl);
    renderHardwareSetup();

    const dialog = await openShellyAddDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rozpocznij skan' }));

    const stopButton = await within(dialog).findByRole('button', { name: 'Stop skanu' });
    fireEvent.click(stopButton);

    await waitFor(() => expect(abortableFetch.getAbortCount()).toBeGreaterThan(0));
    expect(within(dialog).getByRole('button', { name: 'Rozpocznij skan' })).toBeEnabled();
    expect(
      within(dialog).queryByRole('button', { name: 'Stop skanu' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Skan zatrzymany.')).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText(/Nie znalazłem gniazdka Shelly/i)
    ).not.toBeInTheDocument();
  });

  it('stops an active Shelly scan when closing the add task'"""
t, n = stop_re.subn(stop_new, t, count=1)
if n != 1:
    raise SystemExit(f'expected stop-scan test block, got {n}')

close_re = re.compile(
    r"  it\('stops an active Shelly scan when closing the add task', async \(\) => \{.*?\n  \}\);\n\n  it\('shows a friendly message when the address does not return Shelly JSON'",
    re.S,
)
close_new = """  it('stops an active Shelly scan when closing the add task', async () => {
    const abortableFetch = createAbortableFetchMock();
    vi.stubGlobal('fetch', abortableFetch.fetchImpl);
    renderHardwareSetup();

    const dialog = await openShellyAddDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rozpocznij skan' }));
    await within(dialog).findByRole('button', { name: 'Stop skanu' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Zamknij' }));

    await waitFor(() => expect(abortableFetch.getAbortCount()).toBeGreaterThan(0));
    expect(
      screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })
    ).not.toBeInTheDocument();
  });

  it('shows a friendly message when the address does not return Shelly JSON'"""
t, n = close_re.subn(close_new, t, count=1)
if n != 1:
    raise SystemExit(f'expected close-scan test block, got {n}')

# Remaining scan tests (range continuation, tooltip, validation etc.) should operate on
# the one add-task dialog rather than opening a second modal. Apply that migration to
# every old open-scan sequence still present.
open_re = re.compile(
    r"\n\s*fireEvent\.click\(within\(addDialog\)\.getByRole\('button', \{ name: 'Skanuj sieć' \}\)\);\n\s*const dialog = await screen\.findByRole\('dialog', \{ name: 'Skanuj sieć Shelly' \}\);"
)
t, migrated = open_re.subn("\n    const dialog = addDialog;", t)
if migrated < 2:
    raise SystemExit(f'expected at least two remaining standalone scan openings, got {migrated}')

# There must be no test left that expects the removed standalone scan dialog.
if "name: 'Skanuj sieć Shelly'" in t:
    raise SystemExit('stale standalone Shelly scan dialog assertion remains')

test_path.write_text(t)
PY

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/__tests__/hardware-setup.test.tsx

pnpm quality:ux
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run src/__tests__/hardware-setup.test.tsx
pnpm --filter @lcl/mobile test -- --run
pnpm --filter @lcl/mobile build

CHANGED=$(git diff --name-only | sort)
printf '%s\n' "$CHANGED"
for f in $CHANGED; do
  case "$f" in
    apps/mobile/src/__tests__/hardware-setup.test.tsx|apps/mobile/src/app/locales/de.ts|apps/mobile/src/app/locales/en.ts|apps/mobile/src/app/locales/es.ts|apps/mobile/src/app/locales/fr.ts|apps/mobile/src/app/locales/it.ts|apps/mobile/src/app/locales/pl.ts|apps/mobile/src/app/locales/ptBr.ts|apps/mobile/src/components/AppBottomNavigation.css|apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx|apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx|apps/mobile/src/theme/theme.css|packages/ui/src/primitives/Modal.tsx|packages/ui/src/styles.css) ;;
    *) echo "Unexpected changed file: $f" >&2; exit 1 ;;
  esac
done

pnpm check

git add $CHANGED
git diff --cached --check
git commit -m "Unify mobile setup task flows"
git push origin "$BRANCH"

SHA=$(git rev-parse HEAD)
printf 'STAGE5_SHA=%s\n' "$SHA"
printf 'STAGE5_PARENT=%s\n' "$(git rev-parse HEAD^)"
printf 'STAGE5_BUILD=1\n'
test "$(git rev-parse HEAD^)" = "$BASE"
test -z "$(git status --porcelain)"
