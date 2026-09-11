#!/usr/bin/env sh
set -eu

BASE=974a25872f05758a54437f37c931f6769793b4ea
BRANCH=work/ux-polish-20260911

git fetch origin agent-control "$BRANCH" >/dev/null
test "$(git rev-parse origin/$BRANCH)" = "$BASE"

# Reproduce the stage-4 candidate plus the already-corrected expectations from v2.
git show origin/agent-control:.agent/scripts/run-shelly-control-polish-stage4-v2-20260911.sh > /tmp/shelly-stage4-v2.sh
set +e
sh /tmp/shelly-stage4-v2.sh
V2_RC=$?
set -e

if [ "$V2_RC" -eq 0 ]; then
  echo "STAGE4_V2_ALREADY_SUCCEEDED=1"
  exit 0
fi

test "$(git branch --show-current)" = "$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
s = p.read_text()

start = s.index("  it('sets relay OFF before stopping a script during delete even when Script.Stop fails'")
end = s.index("\n  it(", start + 5)
block = s[start:end]

old = """    const defaultFetch = vi.mocked(fetch);\n    vi.stubGlobal("""
new = """    const defaultFetch = vi.mocked(fetch);\n    await defaultFetch(new URL('http://192.168.0.20/rpc'), {\n      method: 'POST',\n      body: JSON.stringify({\n        id: 1,\n        method: 'Switch.Set',\n        params: { id: 0, on: true }\n      })\n    });\n    vi.stubGlobal("""
if block.count(old) != 1:
    raise SystemExit(f'delete test fetch setup: expected 1 match, got {block.count(old)}')
block = block.replace(old, new, 1)

old = """    const savedPlugList = screen.getByLabelText('Dodane gniazdka');\n    const actionRow = within(savedPlugList).getByLabelText(/^Sterowanie /);\n    fireEvent.click(within(actionRow).getByRole('button', { name: 'ON' }));\n    await screen.findByText('Przekaźnik ON.');\n\n"""
if block.count(old) != 1:
    raise SystemExit(f'delete test legacy relay setup: expected 1 match, got {block.count(old)}')
block = block.replace(old, '', 1)

s = s[:start] + block + s[end:]
p.write_text(s)
PY

pnpm exec prettier --write apps/mobile/src/__tests__/hardware-setup.test.tsx
pnpm exec eslint \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/theme/theme.css \
  apps/mobile/src/__tests__/hardware-setup.test.tsx
pnpm quality:ux
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile test -- hardware-setup.test.tsx
pnpm --filter @lcl/mobile build
git diff --check

git add \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/theme/theme.css \
  apps/mobile/src/__tests__/hardware-setup.test.tsx

git diff --cached --check
git commit -m "Align Shelly runtime controls with dashboard"
git push --force-with-lease origin "$BRANCH"

echo SHELLY_STAGE4_SHA=$(git rev-parse HEAD)
