#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
cd "$REPO"
git fetch origin agent-control work/device-rule-decoupling-20260913
git show origin/agent-control:.agent/scripts/20260913-rule-lifecycle-v1.sh > /tmp/lcl-rule-lifecycle-v2-base.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/lcl-rule-lifecycle-v2-base.sh')
s = p.read_text()

old_import = """  automationRuleSchema,\n  type AutomationRule,\n  type ClimateRule,\n  type TimeRule\n"""
new_import = """  automationRuleSchema,\n  type AutomationRule,\n  type ClimateRule\n"""
if old_import not in s:
    raise SystemExit('lifecycle import anchor missing')
s = s.replace(old_import, new_import, 1)

old_recover = """    const rule = requireRule(ruleId, deps);\n    if (!rule.deployment) return deployRule(ruleId, deps);\n    const { plug } = requireDevices(rule, deps);\n"""
new_recover = """    const rule = requireRule(ruleId, deps);\n    if (!rule.deployment) {\n      const deployed = await deployRemote(rule, deps);\n      try {\n        return unwrapRegistry(\n          deps.stores.upsertRule({ ...deployed, updatedAtMs: deps.now() })\n        );\n      } catch (error) {\n        await deleteRemote(deployed, deps).catch(() => undefined);\n        throw error;\n      }\n    }\n    const { plug } = requireDevices(rule, deps);\n"""
if old_recover not in s:
    raise SystemExit('undeployed recovery anchor missing')
s = s.replace(old_recover, new_recover, 1)

anchor = """  it('recovers only after runtime inventory confirms missing ownership', async () => {\n"""
test = """  it('recovers an undeployed rule without re-entering the plug queue', async () => {\n    const harness = createHarness([time]);\n    const recovered = await recoverRule(time.id, harness.deps);\n    expect(harness.events.filter((event) => event === 'queue')).toHaveLength(1);\n    expect(harness.runtime.deployTime).toHaveBeenCalledOnce();\n    expect(recovered.deployment).not.toBeNull();\n  });\n\n"""
if anchor not in s:
    raise SystemExit('lifecycle recovery test anchor missing')
s = s.replace(anchor, test + anchor, 1)

p.write_text(s)
PY
bash /tmp/lcl-rule-lifecycle-v2-base.sh
