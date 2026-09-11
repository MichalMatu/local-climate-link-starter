#!/usr/bin/env sh
set -eu

BRANCH=work/production-readiness-hardening-20260911
git fetch --prune origin "$BRANCH" >/dev/null
BASE=$(git rev-parse "origin/$BRANCH")
test "$(git log -1 --format=%s "origin/$BRANCH")" = "refactor(mobile): decompose hardware setup flow"
git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null
test -z "$(git status --porcelain)"

python3 - <<'PY'
from pathlib import Path
import re

flow_path=Path('apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts')
flow=flow_path.read_text()
start=flow.rfind('\n  return {')
end=flow.find('\n  };',start)
if start==-1 or end==-1: raise SystemExit('hardware setup return boundary not found')
body=flow[start:end]
internal_only={
  'advancedSettingsValidation',
  'currentScriptHash',
  'lastInstallState',
  'isLastInstallCurrent',
  'isSafeRelayTestComplete',
  'refreshShellyControlMutation',
  'turnRelayOnMutation',
  'turnRelayOffMutation',
  'setAutomationAutoMutation',
  'setAutomationManualMutation',
  'automationScriptState'
}
lines=body.splitlines()
seen=set()
kept=[]
for line in lines:
    stripped=line.strip()
    key=None
    m=re.match(r'^([A-Za-z_$][\w$]*)(?:,|:)', stripped)
    if m: key=m.group(1)
    if key in internal_only:
        seen.add(key)
        continue
    kept.append(line)
missing=internal_only-seen
if missing: raise SystemExit(f'internal return fields not found: {sorted(missing)}')
new_body='\n'.join(kept)
flow=flow[:start]+new_body+flow[end:]
flow_path.write_text(flow)

# Re-read the pruned public return surface.
flow=flow_path.read_text()
start=flow.rfind('\n  return {')
end=flow.find('\n  };',start)
body=flow[start:end]
return_fields=set(re.findall(r'^    ([A-Za-z_$][\w$]*)(?:,|:)',body,re.M))
if not return_fields: raise SystemExit('failed to parse public hardware flow fields')

page_root=Path('apps/mobile/src/screens/hardware-setup/pages')
contract_sources={
  'ShellySetupFlow': [page_root/'ShellySetupPage.tsx', page_root/'ShellySetupPresentation.tsx'],
  'SensorSetupFlow': [page_root/'SensorSetupPage.tsx'],
  'RuleSetupFlow': [page_root/'RuleSetupPage.tsx'],
  'DiagnosticsSetupFlow': [page_root/'DiagnosticsSetupPage.tsx'],
  'TimeScheduleSetupFlow': [page_root/'TimeScheduleSetupPage.tsx']
}
extra_fields={
  'RuleSetupFlow': {
    'selectedShelly','configState','isThresholdValid','isAdvancedSettingsValid',
    'isVpdAssistValid','shellyBaseUrl','selectedSensor'
  }
}
contracts={}
for name,paths in contract_sources.items():
    used=set()
    for path in paths:
        source=path.read_text()
        used.update(re.findall(r'\bflow\.([A-Za-z_$][\w$]*)',source))
    used.update(extra_fields.get(name,set()))
    unknown=used-return_fields
    if unknown:
        raise SystemExit(f'{name} references fields outside public flow: {sorted(unknown)}')
    contracts[name]=sorted(used)

out=["import type { HardwareSetupFlow } from '../../flows/hardware-setup/useHardwareSetupFlow.js';",'']
for name,fields in contracts.items():
    out.append(f'export type {name} = Pick<')
    out.append('  HardwareSetupFlow,')
    for i,field in enumerate(fields):
        prefix='  | ' if i==0 else '  | '
        out.append(f"{prefix}'{field}'")
    out.append('>;')
    out.append('')
Path('apps/mobile/src/screens/hardware-setup/pageContracts.ts').write_text('\n'.join(out))

# Make the shared prop wrapper generic; each page must opt into its narrow contract.
helpers=Path('apps/mobile/src/screens/hardware-setup/helpers.ts')
s=helpers.read_text()
old="""export interface HardwarePageProps {
  flow: HardwareSetupFlow;
}
"""
new="""export interface HardwarePageProps<TFlow> {
  flow: TFlow;
}
"""
if s.count(old)!=1: raise SystemExit(f'HardwarePageProps marker mismatch: {s.count(old)}')
helpers.write_text(s.replace(old,new,1))

def narrow_page(path: Path, contract: str):
    s=path.read_text()
    helper_end=s.find("from '../helpers.js';")
    if helper_end==-1: raise SystemExit(f'{path}: helpers import not found')
    helper_start=s.rfind('import',0,helper_end)
    helper_stmt_end=s.find('\n',helper_end)
    block=s[helper_start:helper_stmt_end+1]
    if 'HardwarePageProps' not in block:
        raise SystemExit(f'{path}: HardwarePageProps not found in helper import')
    protected=block.replace('HardwarePageProps','__HPP_IMPORT__')
    s=s[:helper_start]+protected+s[helper_stmt_end+1:]
    s=s.replace("HardwarePageProps['flow']", contract)
    s=s.replace('HardwarePageProps',f'HardwarePageProps<{contract}>')
    s=s.replace('__HPP_IMPORT__','HardwarePageProps')
    # Insert contract import after helpers import, which may have shifted only by equal-ish text.
    helper_end=s.find("from '../helpers.js';")
    line_end=s.find('\n',helper_end)
    contract_import=f"import type {{ {contract} }} from '../pageContracts.js';\n"
    if contract_import not in s:
        s=s[:line_end+1]+contract_import+s[line_end+1:]
    path.write_text(s)

narrow_page(page_root/'ShellySetupPage.tsx','ShellySetupFlow')
narrow_page(page_root/'SensorSetupPage.tsx','SensorSetupFlow')
narrow_page(page_root/'RuleSetupPage.tsx','RuleSetupFlow')
narrow_page(page_root/'DiagnosticsSetupPage.tsx','DiagnosticsSetupFlow')
narrow_page(page_root/'TimeScheduleSetupPage.tsx','TimeScheduleSetupFlow')

# Presentation helpers receive the same narrow Shelly contract, not the whole god-flow type.
p=page_root/'ShellySetupPresentation.tsx'
s=p.read_text()
old="import type { HardwarePageProps } from '../helpers.js';\n"
if old not in s: raise SystemExit('Shelly presentation HardwarePageProps import not found')
s=s.replace(old,"import type { ShellySetupFlow } from '../pageContracts.js';\n",1)
s=s.replace("HardwarePageProps['flow']",'ShellySetupFlow')
p.write_text(s)

# Add architecture ratchets to repository quality gate.
p=Path('scripts/quality/repository-gate.mjs')
s=p.read_text()
marker='await checkReleaseVersionConsistency();\n'
if marker not in s: raise SystemExit('repository gate await marker missing')
fn=r'''const checkHardwareSetupArchitecture = async () => {
  const orchestratorPath =
    'apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts';
  const orchestrator = await readRepoFile(orchestratorPath);
  const orchestratorLines = orchestrator.split('\n').length;
  if (orchestratorLines > 1150) {
    addFailure(
      orchestratorPath,
      `hardware setup orchestrator exceeds 1150 lines (${orchestratorLines}); extract a cohesive subsystem instead of growing the god-flow`
    );
  }

  const returnStart = orchestrator.lastIndexOf('\n  return {');
  const returnEnd = orchestrator.indexOf('\n  };', returnStart);
  if (returnStart === -1 || returnEnd === -1) {
    addFailure(orchestratorPath, 'cannot locate hardware setup public return surface');
  } else {
    const returnBody = orchestrator.slice(returnStart, returnEnd);
    const publicFields = [
      ...returnBody.matchAll(/^    ([A-Za-z_$][\w$]*)(?:,|:)/gm)
    ].map((match) => match[1]);
    if (publicFields.length > 110) {
      addFailure(
        orchestratorPath,
        `hardware setup public API has ${publicFields.length} fields; keep page contracts narrow and remove internal-only return values`
      );
    }
  }

  for (const forbidden of [
    'new CapacitorBleScanner',
    'generateShellyBleDiscoveryScript()',
    'const setShellyControlState =',
    'setPvvxDeviceTime({'
  ]) {
    if (orchestrator.includes(forbidden)) {
      addFailure(
        orchestratorPath,
        `subsystem implementation leaked back into the orchestrator: ${forbidden}`
      );
    }
  }

  const subsystemBudgets = {
    'apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts': 350,
    'apps/mobile/src/flows/hardware-setup/useShellyBleDiscoveryFlow.ts': 350,
    'apps/mobile/src/flows/hardware-setup/usePhoneSensorFlow.ts': 350
  };
  for (const [path, maxLines] of Object.entries(subsystemBudgets)) {
    const source = await readRepoFile(path);
    const lines = source.split('\n').length;
    if (lines > maxLines) {
      addFailure(path, `extracted hardware subsystem exceeds ${maxLines} lines (${lines})`);
    }
  }

  const pageContracts = {
    'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx':
      'ShellySetupFlow',
    'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx':
      'ShellySetupFlow',
    'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx':
      'SensorSetupFlow',
    'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx': 'RuleSetupFlow',
    'apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx':
      'DiagnosticsSetupFlow',
    'apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx':
      'TimeScheduleSetupFlow'
  };
  for (const [path, contract] of Object.entries(pageContracts)) {
    const source = await readRepoFile(path);
    if (!source.includes(contract)) {
      addFailure(path, `hardware setup page must use the narrow ${contract} contract`);
    }
    if (source.includes('HardwareSetupFlow')) {
      addFailure(path, 'hardware setup page must not depend on the full HardwareSetupFlow');
    }
    if (source.includes("HardwarePageProps['flow']")) {
      addFailure(path, 'hardware setup page must not recover the full flow through HardwarePageProps');
    }
  }
};

'''
s=s.replace(marker,fn+marker,1)
s=s.replace('await checkDomainPackageBoundaries();\n','await checkDomainPackageBoundaries();\nawait checkHardwareSetupArchitecture();\n',1)
p.write_text(s)

# Add the bottom-navigation shell contract that previously prevented toast/nav overlap regressions.
p=Path('scripts/quality/ux-gate.mjs')
s=p.read_text()
marker='const checkSavedShellyCardFeedback = async () => {\n'
if marker not in s: raise SystemExit('UX gate function marker missing')
fn=r'''const checkBottomNavigationShell = async () => {
  const tsxPaths = (await listRepoFiles('apps/mobile/src')).filter((path) =>
    path.endsWith('.tsx')
  );
  for (const path of tsxPaths) {
    const source = await readRepoFile(path);
    if (
      source.includes('<AppBottomNavigation') &&
      source.includes('<main') &&
      !source.includes('app-bottom-nav-shell')
    ) {
      addFailure(
        path,
        'screens rendering AppBottomNavigation must opt into app-bottom-nav-shell spacing'
      );
    }
  }
};

'''
s=s.replace(marker,fn+marker,1)
# Append call just before the existing feedback contract call sequence if possible.
call_marker='await checkSavedShellyCardFeedback();\n'
if call_marker not in s: raise SystemExit('UX gate call marker missing')
s=s.replace(call_marker,'await checkBottomNavigationShell();\n'+call_marker,1)
p.write_text(s)

print('PUBLIC_HARDWARE_FLOW_FIELDS=',len(return_fields))
for name,fields in contracts.items():
    print(f'{name}={len(fields)}:{",".join(fields)}')
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts \
  apps/mobile/src/screens/hardware-setup/helpers.ts \
  apps/mobile/src/screens/hardware-setup/pageContracts.ts \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx \
  scripts/quality/repository-gate.mjs \
  scripts/quality/ux-gate.mjs

git diff --check
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile lint
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile test -- --run src/__tests__/hardware-setup.test.tsx
pnpm check:full

python3 - <<'PY'
from pathlib import Path
import re
p=Path('apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts')
s=p.read_text()
start=s.rfind('\n  return {'); end=s.find('\n  };',start)
body=s[start:end]
fields=re.findall(r'^    ([A-Za-z_$][\w$]*)(?:,|:)',body,re.M)
print(f'FINAL_HARDWARE_SETUP_FLOW_LINES={len(s.splitlines())}')
print(f'FINAL_HARDWARE_SETUP_PUBLIC_FIELDS={len(fields)}')
if len(fields)>110: raise SystemExit('public flow surface exceeds ratchet')
if len(s.splitlines())>1150: raise SystemExit('orchestrator exceeds ratchet')
print('HARDWARE_PAGE_CONTRACTS_OK=1')
PY

git add apps/mobile/src scripts/quality/repository-gate.mjs scripts/quality/ux-gate.mjs
git diff --cached --check
git commit -m "refactor(mobile): narrow hardware setup contracts"
git push origin "$BRANCH"
echo "HARDWARE_PAGE_CONTRACTS_SHA=$(git rev-parse HEAD)"
