#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-hardware-page-contracts-v1-20260911.sh > /tmp/hardware-page-contracts-v3-inner.sh
python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/hardware-page-contracts-v3-inner.sh')
s=p.read_text()
old="""extra_fields={
  'RuleSetupFlow': {
    'selectedShelly','configState','isThresholdValid','isAdvancedSettingsValid',
    'isVpdAssistValid','shellyBaseUrl','selectedSensor'
  }
}
"""
new="""extra_fields={
  'ShellySetupFlow': {'shellyBaseUrl'},
  'RuleSetupFlow': {
    'selectedShelly','configState','isThresholdValid','isAdvancedSettingsValid',
    'isVpdAssistValid','shellyBaseUrl','selectedSensor'
  }
}
"""
if s.count(old)!=1: raise SystemExit(f'extra_fields marker mismatch: {s.count(old)}')
s=s.replace(old,new,1)
old="""    unknown=used-return_fields
    if unknown:
        raise SystemExit(f'{name} references fields outside public flow: {sorted(unknown)}')
    contracts[name]=sorted(used)
"""
new="""    # Translation keys may contain the literal text `flow.foo`; retain only
    # names that are actually part of the typed public flow surface.
    contracts[name]=sorted(used & return_fields)
"""
if s.count(old)!=1: raise SystemExit(f'contract filtering marker mismatch: {s.count(old)}')
s=s.replace(old,new,1)
needle="""# Make the shared prop wrapper generic; each page must opt into its narrow contract.
helpers=Path('apps/mobile/src/screens/hardware-setup/helpers.ts')
s=helpers.read_text()
"""
replacement=needle+"""s=s.replace(
  'export const canInstallScript = (flow: HardwareSetupFlow): boolean =>',
  \"export const canInstallScript = (\\n  flow: Pick<\\n    HardwareSetupFlow,\\n    | 'selectedShelly'\\n    | 'configState'\\n    | 'isThresholdValid'\\n    | 'isAdvancedSettingsValid'\\n    | 'isVpdAssistValid'\\n  >\\n): boolean =>\"
)
s=s.replace(
  'export const shellyAddressLabel = (flow: HardwareSetupFlow): string =>',
  \"export const shellyAddressLabel = (\\n  flow: Pick<HardwareSetupFlow, 'shellyBaseUrl'>\\n): string =>\"
)
s=s.replace(
  'export const runtimeAddressLabel = (flow: HardwareSetupFlow): string =>',
  \"export const runtimeAddressLabel = (\\n  flow: Pick<HardwareSetupFlow, 'selectedSensor'>\\n): string =>\"
)
"""
if s.count(needle)!=1: raise SystemExit(f'helpers patch marker mismatch: {s.count(needle)}')
s=s.replace(needle,replacement,1)
start=s.find('def narrow_page(path: Path, contract: str):')
end=s.find('# Presentation helpers receive the same narrow Shelly contract',start)
if start==-1 or end==-1: raise SystemExit('narrow_page generator boundaries not found')
block="""def narrow_page(path: Path, contract: str):
    s=path.read_text()
    s=s.replace(\"HardwarePageProps['flow']\", contract)
    s=s.replace('HardwarePageProps &', f'HardwarePageProps<{contract}> &')
    s=s.replace(': HardwarePageProps)', f': HardwarePageProps<{contract}>)')
    s=s.replace(': HardwarePageProps =>', f': HardwarePageProps<{contract}> =>')
    contract_import=f\"import type {{ {contract} }} from '../pageContracts.js';\\n\"
    if contract_import not in s:
        s=contract_import+s
    path.write_text(s)

narrow_page(page_root/'ShellySetupPage.tsx','ShellySetupFlow')
narrow_page(page_root/'SensorSetupPage.tsx','SensorSetupFlow')
narrow_page(page_root/'RuleSetupPage.tsx','RuleSetupFlow')
narrow_page(page_root/'DiagnosticsSetupPage.tsx','DiagnosticsSetupFlow')
narrow_page(page_root/'TimeScheduleSetupPage.tsx','TimeScheduleSetupFlow')

"""
s=s[:start]+block+s[end:]
p.write_text(s)
PY
sh /tmp/hardware-page-contracts-v3-inner.sh
