#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='5b073ae7559a5135d5fa7c8606fc7e5bcc6b54e5'

git fetch --prune origin "$BRANCH" agent-control
if [ -n "$(git status --porcelain)" ]; then
  echo 'ERROR: working tree is not clean.' >&2
  git status --short >&2
  exit 20
fi
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"

python3 - <<'PY'
from pathlib import Path

p = Path('apps/mobile/src/flows/registry/result.ts')
s = p.read_text()
s = s.replace(
"""  | { kind: 'device-missing'; deviceKind: 'plug' | 'sensor'; deviceId: string }
  | { kind: 'deployment-attached'; ruleId: string };
""",
"""  | { kind: 'device-missing'; deviceKind: 'plug' | 'sensor'; deviceId: string }
  | { kind: 'rule-relay-conflict'; ruleIds: string[] }
  | { kind: 'deployment-attached'; ruleId: string };
""",
1,
)
p.write_text(s)

p = Path('apps/mobile/src/flows/registry/store.ts')
s = p.read_text()
s = s.replace(
"beforeUpsert(item: T, existing: T | undefined): RegistryResult<null>;",
"beforeUpsert(item: T, existing: T | undefined, items: readonly T[]): RegistryResult<null>;",
1,
)
s = s.replace(
"const checked = beforeUpsert(parsed.data, existing);",
"const checked = beforeUpsert(parsed.data, existing, items);",
1,
)
p.write_text(s)

p = Path('apps/mobile/src/flows/rules/store.ts')
s = p.read_text()
old = """    beforeUpsert: (rule, existing) => {
      if (
        existing?.deployment &&
        (existing.kind !== rule.kind ||
          existing.plugId !== rule.plugId ||
          existing.relayId !== rule.relayId ||
          (existing.kind === 'climate' &&
            rule.kind === 'climate' &&
            existing.sensorId !== rule.sensorId))
      ) {
        return { ok: false, error: { kind: 'deployment-attached', ruleId: rule.id } };
      }
      const devices = readDevices();
"""
new = """    beforeUpsert: (rule, existing, rules) => {
      const competingRuleIds = rules
        .filter(
          (candidate) =>
            candidate.id !== rule.id &&
            candidate.plugId === rule.plugId &&
            candidate.relayId === rule.relayId
        )
        .map((candidate) => candidate.id);
      if (competingRuleIds.length > 0) {
        return {
          ok: false,
          error: { kind: 'rule-relay-conflict', ruleIds: competingRuleIds }
        };
      }
      if (existing?.deployment) {
        const bindingChanged =
          existing.kind !== rule.kind ||
          existing.plugId !== rule.plugId ||
          existing.relayId !== rule.relayId ||
          (existing.kind === 'climate' &&
            rule.kind === 'climate' &&
            existing.sensorId !== rule.sensorId);
        const desiredConfigChanged =
          existing.kind === rule.kind &&
          JSON.stringify(existing.config) !== JSON.stringify(rule.config);
        if (bindingChanged || desiredConfigChanged) {
          return {
            ok: false,
            error: { kind: 'deployment-attached', ruleId: rule.id }
          };
        }
      }
      const devices = readDevices();
"""
if old not in s:
    raise SystemExit('rule store anchor not found')
s = s.replace(old, new, 1)
p.write_text(s)

p = Path('apps/mobile/src/flows/registry/devicesAndRules.test.ts')
s = p.read_text()
anchor = """  it('validates settings without accepting copied device snapshots or duplicate schedule ids', () => {
"""
insert = """  it('rejects two saved rules claiming the same plug relay', () => {
    const { rules } = seeded();
    expect(rules.getState().upsert(climate).ok).toBe(true);
    expect(rules.getState().upsert(time)).toEqual({
      ok: false,
      error: { kind: 'rule-relay-conflict', ruleIds: [climate.id] }
    });
    expect(rules.getState().items).toEqual([climate]);
  });

  it('does not let desired config drift away from an attached deployment', () => {
    const { rules } = seeded();
    const deployedClimate = {
      ...climate,
      deployment: {
        scriptId: 7,
        scriptHash: 'hash',
        safetyTest: { status: 'pending' as const }
      }
    };
    expect(rules.getState().upsert(deployedClimate).ok).toBe(true);
    expect(
      rules.getState().upsert({
        ...deployedClimate,
        config: {
          ...deployedClimate.config,
          rule: {
            ...deployedClimate.config.rule,
            control: {
              ...deployedClimate.config.rule.control,
              onThreshold: 18
            }
          }
        }
      })
    ).toEqual({
      ok: false,
      error: { kind: 'deployment-attached', ruleId: climate.id }
    });
    expect(
      rules.getState().upsert({
        ...deployedClimate,
        deployment: {
          ...deployedClimate.deployment,
          safetyTest: { status: 'verified' as const, verifiedAtMs: 10 }
        },
        updatedAtMs: 10
      }).ok
    ).toBe(true);
  });

"""
if anchor not in s:
    raise SystemExit('registry test anchor not found')
s = s.replace(anchor, insert + anchor, 1)
p.write_text(s)

p = Path('docs/implementation/device-rule-decoupling-progress.md')
s = p.read_text()
marker = "## Remaining work and exact next step\n"
entry = """### Registry audit hardening\n\nThe rule registry now rejects a second saved rule for the same `(plugId, relayId)`\nand rejects desired configuration/binding changes while deployment metadata is\nattached. Deployment-state-only updates remain allowed so safety verification can\nadvance. A later runtime transaction API must explicitly detach/commit deployment\nwhen editing an already deployed rule.\n\n"""
if entry not in s:
    s = s.replace(marker, entry + marker, 1)
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/registry/result.ts \
  apps/mobile/src/flows/registry/store.ts \
  apps/mobile/src/flows/rules/store.ts \
  apps/mobile/src/flows/registry/devicesAndRules.test.ts \
  docs/implementation/device-rule-decoupling-progress.md

git diff --check
pnpm --dir apps/mobile exec vitest run \
  src/flows/registry/devicesAndRules.test.ts \
  src/flows/rules/ownership.test.ts
pnpm quality:repo
pnpm typecheck

git add \
  apps/mobile/src/flows/registry/result.ts \
  apps/mobile/src/flows/registry/store.ts \
  apps/mobile/src/flows/rules/store.ts \
  apps/mobile/src/flows/registry/devicesAndRules.test.ts \
  docs/implementation/device-rule-decoupling-progress.md
git commit -m 'Enforce rule registry ownership invariants'
git push origin HEAD:"$BRANCH"

echo "RULE_REGISTRY_HEAD=$(git rev-parse HEAD)"
test -z "$(git status --porcelain)"
