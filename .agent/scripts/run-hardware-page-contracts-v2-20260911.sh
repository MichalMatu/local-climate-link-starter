#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-hardware-page-contracts-v1-20260911.sh > /tmp/hardware-page-contracts-v2-inner.sh
python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/hardware-page-contracts-v2-inner.sh')
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
new="""    # Text such as translation keys can contain `flow.foo`; TypeScript is the
    # authority for real property access, so retain only actual public fields.
    contracts[name]=sorted(used & return_fields)
"""
if s.count(old)!=1: raise SystemExit(f'contract unknown marker mismatch: {s.count(old)}')
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
p.write_text(s)
PY
sh /tmp/hardware-page-contracts-v2-inner.sh
