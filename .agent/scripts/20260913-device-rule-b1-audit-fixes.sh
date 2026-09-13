#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='0a1452c2a082deda381333645b34818210bad144'

cleanup() {
  true
}
trap cleanup EXIT INT TERM

git fetch --prune origin "$BRANCH" main agent-control
if [ -n "$(git status --porcelain)" ]; then
  echo 'ERROR: working tree is not clean; refusing to mutate it.' >&2
  git status --short >&2
  exit 20
fi
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
test -z "$(git status --porcelain)"

# Bring in the single newer main change (.gitignore for local OpenVisio cache).
git merge --no-edit origin/main

python3 - <<'PY'
from pathlib import Path

prompt = Path('docs/implementation/device-rule-decoupling-astra-prompt.md')
text = prompt.read_text()
text = '\n'.join(line.rstrip() for line in text.split('\n'))
prompt.write_text(text)

runtime = Path('apps/mobile/src/flows/devices/plugs/runtime.ts')
s = runtime.read_text()
old = """  if (initial.value.ownership.status !== 'no-conflict')
    return {
      ok: false,
      error: { kind: 'relay-owned', conflicts: initial.value.ownership.conflicts }
    };
  const command = fromShellyResult(
"""
new = """  if (initial.value.ownership.status !== 'no-conflict')
    return {
      ok: false,
      error: { kind: 'relay-owned', conflicts: initial.value.ownership.conflicts }
    };
  const currentIdentity = await verifyPlugIdentity(plug, clients);
  if (!currentIdentity.ok) return currentIdentity;
  const command = fromShellyResult(
"""
if old not in s:
    raise SystemExit('runtime direct-control anchor not found')
s = s.replace(old, new, 1)
old = """  const deleted = fromShellyResult(await clients.device.deleteScript(scriptId));
"""
new = """  const currentIdentity = await verifyPlugIdentity(plug, clients);
  if (!currentIdentity.ok) return currentIdentity;
  const deleted = fromShellyResult(await clients.device.deleteScript(scriptId));
"""
if old not in s:
    raise SystemExit('runtime delete anchor not found')
s = s.replace(old, new, 1)
runtime.write_text(s)

test = Path('apps/mobile/src/flows/devices/plugs/runtime.test.ts')
s = test.read_text()
anchor = """  it('an unconfirmed ON command forces and verifies OFF', async () => {
"""
insert = """  it('re-verifies physical identity immediately before direct relay mutation', async () => {
    const { clients } = fixture();
    vi.mocked(clients.device.getDeviceInfo)
      .mockResolvedValueOnce(ok({ id: plug.id, model: plug.model, gen: plug.gen }))
      .mockResolvedValueOnce(ok({ id: 'different', model: plug.model, gen: plug.gen }));
    expect(
      await setUnownedPlugRelay({ plug, rules: [], on: true, clients })
    ).toEqual({ ok: false, error: { kind: 'identity-mismatch' } });
    expect(clients.device.setRelayOn).not.toHaveBeenCalled();
    expect(clients.device.setRelayOff).not.toHaveBeenCalled();
  });

"""
if anchor not in s:
    raise SystemExit('runtime test direct-control anchor not found')
s = s.replace(anchor, insert + anchor, 1)
anchor = """  it('does not delete an id renamed during cleanup', async () => {
"""
insert = """  it('re-verifies physical identity immediately before deleting an orphan script', async () => {
    const { clients, setScripts } = fixture();
    setScripts([{ ...script, running: false }]);
    vi.mocked(clients.device.getDeviceInfo)
      .mockResolvedValueOnce(ok({ id: plug.id, model: plug.model, gen: plug.gen }))
      .mockResolvedValueOnce(ok({ id: plug.id, model: plug.model, gen: plug.gen }))
      .mockResolvedValueOnce(ok({ id: 'different', model: plug.model, gen: plug.gen }));
    expect(
      await deleteOrphanClimateScript({ plug, rules: [], scriptId: 7, clients })
    ).toEqual({ ok: false, error: { kind: 'identity-mismatch' } });
    expect(clients.device.deleteScript).not.toHaveBeenCalled();
    expect(clients.device.setRelayOff).toHaveBeenCalledTimes(1);
  });

"""
if anchor not in s:
    raise SystemExit('runtime test delete anchor not found')
s = s.replace(anchor, insert + anchor, 1)
test.write_text(s)

progress = Path('docs/implementation/device-rule-decoupling-progress.md')
s = progress.read_text()
s = s.replace(
    "Completed implementation commit:\n\n- `a3da0a14` — Phase A: independent device/rule models, persistence and ownership.\n",
    "Completed implementation commits:\n\n- `a3da0a14` — Phase A: independent device/rule models, persistence and ownership.\n- `0a1452c2` — Phase B1: standalone plug runtime services and hardware smoke.\n",
    1,
)
marker = "## Remaining work and exact next step\n"
audit = """## ChatGPT audit follow-up\n\nThe post-Codex audit found a time-of-check/time-of-use identity gap in B1: direct\nrelay mutation and orphan script deletion trusted the physical identity checked\nearlier in a multi-RPC operation. The service now re-verifies Shelly device id,\nmodel and generation immediately before the destructive relay/script mutation.\nRegression tests cover endpoint reassignment between inventory and mutation.\n\nA separate rule-lifecycle concern remains intentionally tracked for the product\ncutover: generic registry writes must not let desired rule config drift away from\nan attached deployment. This must be solved together with the runtime update\ntransaction API rather than by a persistence-only restriction that would block\nlegitimate verified updates. Rule creation also must use the live ownership resolver\nbefore persistence so two rules cannot claim the same relay through normal product\nflows.\n\n"""
if marker not in s:
    raise SystemExit('progress marker not found')
s = s.replace(marker, audit + marker, 1)
progress.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/devices/plugs/runtime.ts \
  apps/mobile/src/flows/devices/plugs/runtime.test.ts \
  docs/implementation/device-rule-decoupling-astra-prompt.md \
  docs/implementation/device-rule-decoupling-progress.md

git diff --check
pnpm --dir apps/mobile exec vitest run \
  src/flows/devices/plugs/runtime.test.ts \
  src/flows/registry/devicesAndRules.test.ts \
  src/flows/rules/ownership.test.ts \
  src/flows/time-automation/runtime.test.ts
pnpm --dir packages/shelly-client exec vitest run src/__tests__/inventory.test.ts
pnpm check:full

git diff --check
git status --short

git add \
  .gitignore \
  apps/mobile/src/flows/devices/plugs/runtime.ts \
  apps/mobile/src/flows/devices/plugs/runtime.test.ts \
  docs/implementation/device-rule-decoupling-astra-prompt.md \
  docs/implementation/device-rule-decoupling-progress.md
# .gitignore may already be committed by the merge; exact add is harmless.
git commit -m 'Harden plug runtime identity checks'
git push origin HEAD:"$BRANCH"

echo "AUDIT_FIX_HEAD=$(git rev-parse HEAD)"
echo 'AUDIT_FIX_CHECK_FULL=1'
test -z "$(git status --porcelain)"
