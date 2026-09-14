#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=d1a4262056017e975e11d943e500310393e06363
cd "$REPO"

git fetch origin "$BRANCH"
REMOTE=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE" == "$EXPECTED" ]] || { echo "Unexpected remote head: $REMOTE"; exit 2; }
git checkout "$BRANCH"
git reset --hard "$REMOTE"
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

python3 - <<'PY'
from pathlib import Path

p = Path('apps/mobile/src/flows/rules/lifecycle.ts')
s = p.read_text()
old = '''const persistDetachedThenAttached = (\n  previous: AutomationRule,\n  next: AutomationRule,\n  deps: RuleLifecycleDependencies\n): AutomationRule => {\n  unwrapRegistry(\n    deps.stores.upsertRule({ ...previous, deployment: null, updatedAtMs: deps.now() })\n  );\n  return unwrapRegistry(deps.stores.upsertRule(next));\n};\n'''
new = '''const persistDesiredUndeployed = (\n  desired: AutomationRule,\n  deps: RuleLifecycleDependencies\n): AutomationRule =>\n  unwrapRegistry(\n    deps.stores.upsertRule({ ...desired, deployment: null, updatedAtMs: deps.now() })\n  );\n\nconst persistRemoteDeployment = async (\n  desired: AutomationRule,\n  deployed: AutomationRule,\n  deps: RuleLifecycleDependencies\n): Promise<AutomationRule> => {\n  const attached = { ...deployed, updatedAtMs: deps.now() } as AutomationRule;\n  try {\n    return unwrapRegistry(deps.stores.upsertRule(attached));\n  } catch (error) {\n    await deleteRemote(attached, deps).catch(() => undefined);\n    deps.stores.upsertRule({\n      ...desired,\n      deployment: null,\n      updatedAtMs: deps.now()\n    });\n    throw error;\n  }\n};\n'''
if old not in s:
    raise SystemExit('persistDetachedThenAttached block missing')
s = s.replace(old, new, 1)

s = s.replace(
'''    } catch (error) {\n      persistDetachedThenAttached(current, desired, deps);\n      throw error;\n    }\n''',
'''    } catch (error) {\n      persistDesiredUndeployed(desired, deps);\n      throw error;\n    }\n''',
1
)
s = s.replace(
'''    } catch (error) {\n      persistDetachedThenAttached(previous, desired, deps);\n      throw error;\n    }\n  }\n  return persistDetachedThenAttached(\n    previous,\n    { ...deployed, updatedAtMs: deps.now() },\n    deps\n  );\n};\n''',
'''    } catch (error) {\n      persistDesiredUndeployed(desired, deps);\n      throw error;\n    }\n  }\n  return persistRemoteDeployment(desired, deployed, deps);\n};\n''',
1
)
s = s.replace(
'''    const desired = { ...rule, deployment: null } as AutomationRule;\n    const deployed = await deployRemote(desired, deps);\n    return persistDetachedThenAttached(\n      rule,\n      { ...deployed, updatedAtMs: deps.now() },\n      deps\n    );\n''',
'''    const desired = { ...rule, deployment: null } as AutomationRule;\n    const deployed = await deployRemote(desired, deps);\n    return persistRemoteDeployment(desired, deployed, deps);\n''',
1
)
if 'persistDetachedThenAttached' in s:
    raise SystemExit('legacy persistence helper reference remains')
p.write_text(s)

p = Path('apps/mobile/src/flows/rules/lifecycle.test.ts')
s = p.read_text()
old = '''    expect(harness.events.slice(3)).toEqual([\n      'store:upsert:climate-1:draft',\n      'store:upsert:climate-1:deployed'\n    ]);\n  });\n\n  it('recovers an undeployed rule without re-entering the plug queue', async () => {\n'''
new = '''    expect(harness.events.slice(3)).toEqual(['store:upsert:climate-1:deployed']);\n  });\n\n  it('cleans a new remote deployment and leaves desired config undeployed when redeploy persistence fails', async () => {\n    const previous = { ...climate, deployment: pendingClimate };\n    const desired = {\n      ...climate,\n      name: 'Desired after failed attach',\n      updatedAtMs: 50\n    };\n    const harness = createHarness([previous]);\n    const originalUpsert = harness.deps.stores.upsertRule;\n    let rejectedDeploymentAttach = false;\n    harness.deps.stores.upsertRule = (input: unknown) => {\n      const rule = input as AutomationRule;\n      if (!rejectedDeploymentAttach && rule.deployment) {\n        rejectedDeploymentAttach = true;\n        harness.events.push('store:reject:deployed');\n        return { ok: false, error: { kind: 'storage-unavailable' } };\n      }\n      return originalUpsert(input);\n    };\n\n    await expect(redeployRule(desired, harness.deps)).rejects.toMatchObject({\n      code: 'registry-rejected'\n    });\n\n    expect(harness.runtime.deleteClimate).toHaveBeenCalledTimes(2);\n    expect(harness.events).toEqual([\n      'queue',\n      'remote:delete-climate',\n      'remote:deploy-climate',\n      'store:reject:deployed',\n      'remote:delete-climate',\n      'store:upsert:climate-1:draft'\n    ]);\n    expect(harness.getRules()[0]).toMatchObject({\n      id: climate.id,\n      name: 'Desired after failed attach',\n      deployment: null\n    });\n  });\n\n  it('cleans a recovered remote deployment when persistence fails', async () => {\n    const deployed = {\n      ...time,\n      deployment: { pairs: [{ windowIndex: 0, onJobId: 10, offJobId: 11 }] }\n    };\n    const harness = createHarness([deployed]);\n    harness.runtime.readTime.mockResolvedValueOnce({ scheduleState: 'attention' } as never);\n    const originalUpsert = harness.deps.stores.upsertRule;\n    let rejectedDeploymentAttach = false;\n    harness.deps.stores.upsertRule = (input: unknown) => {\n      const rule = input as AutomationRule;\n      if (!rejectedDeploymentAttach && rule.deployment) {\n        rejectedDeploymentAttach = true;\n        harness.events.push('store:reject:deployed');\n        return { ok: false, error: { kind: 'storage-unavailable' } };\n      }\n      return originalUpsert(input);\n    };\n\n    await expect(recoverRule(time.id, harness.deps)).rejects.toMatchObject({\n      code: 'registry-rejected'\n    });\n\n    expect(harness.runtime.deleteTime).toHaveBeenCalledOnce();\n    expect(harness.getRules()[0]?.deployment).toBeNull();\n  });\n\n  it('recovers an undeployed rule without re-entering the plug queue', async () => {\n'''
if old not in s:
    raise SystemExit('redeploy expectation anchor missing')
s = s.replace(old, new, 1)
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/rules/lifecycle.ts \
  apps/mobile/src/flows/rules/lifecycle.test.ts

pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run src/flows/rules/lifecycle.test.ts
pnpm lint
pnpm quality:repo
pnpm --filter @lcl/mobile build

git add \
  apps/mobile/src/flows/rules/lifecycle.ts \
  apps/mobile/src/flows/rules/lifecycle.test.ts

git commit -m "Harden rule deployment persistence"

git fetch origin "$BRANCH"
REMOTE_AFTER=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE_AFTER" == "$EXPECTED" ]] || { echo "Remote head changed before push: $REMOTE_AFTER"; exit 4; }
git push origin HEAD:"$BRANCH"
git fetch origin "$BRANCH"
FINAL_HEAD=$(git rev-parse "origin/$BRANCH")
echo "FINAL_HEAD=$FINAL_HEAD"
