#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-setup-page-state-hardening-v1-20260911.sh > /tmp/setup-page-state-hardening-v5-inner.sh
python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/setup-page-state-hardening-v5-inner.sh')
s=p.read_text()
marker="""pnpm exec prettier --write \\
  apps/mobile/src/screens/hardware-setup/useToastQueue.ts \\
"""
fix="""python3 - <<'PYFIX'
from pathlib import Path

p=Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
s=p.read_text()
s=s.replace('setIsAddShellyModalOpen(false)', \"setDialog({ kind: 'none' })\")
s=s.replace('setIsAddShellyModalOpen(true)', \"setDialog({ kind: 'add' })\")
for legacy in ['setIsAddShellyModalOpen','setIsStatusModalOpen','setIsScanModalOpen','setIsBleScanModalOpen','setBleScanShelly','setSettingsShellyId','setClockShellyId','setShellyDevicePendingRemoval','setStatusModalAddress','setStatusModalSource','setStatusModalReturnSettingsId','setReturnToAddAfterScan']:
    if legacy in s:
        raise SystemExit(f'Shelly legacy dialog setter remains: {legacy}')
p.write_text(s)

p=Path('apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx')
s=p.read_text()
s=s.replace(\"    setIsDeleteConfirmModalOpen(false);\", \"    setDialog('none');\")
s=s.replace(\"    setIsRelayTestModalOpen(false);\", \"    setDialog('none');\")
s=s.replace(\"  useEffect(() => {\\n    if (dialog === 'delete') setDialog('none');\\n  }, [dialog, flow.selectedShellyId]);\", \"  useEffect(() => {\\n    setDialog((current) => (current === 'delete' ? 'none' : current));\\n  }, [flow.selectedShellyId]);\")
s=s.replace(\"import { useCallback, useEffect, useId, useRef, useState } from 'react';\", \"import { useCallback, useEffect, useId, useState } from 'react';\")
for legacy in ['setIsScriptModalOpen','setIsAdvancedModalOpen','setIsDeleteConfirmModalOpen','setIsInstallBlockModalOpen','setIsRelayTestModalOpen']:
    if legacy in s:
        raise SystemExit(f'Rule legacy dialog setter remains: {legacy}')
p.write_text(s)

p=Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx')
s=p.read_text()
imp=\"import type { SensorSetupFlow } from '../pageContracts.js';\\n\"
if \"from '../useToastQueue.js'\" not in s:
    if imp not in s:
        raise SystemExit('Sensor contract import marker missing')
    s=s.replace(imp, imp+\"import { useToastQueue } from '../useToastQueue.js';\\n\",1)
s=s.replace(\"import { useCallback, useEffect, useId, useRef, useState } from 'react';\", \"import { useEffect, useId, useRef, useState } from 'react';\")
for legacy in ['setIsAddSensorModalOpen','setIsPhoneBleScanModalOpen','setSensorSettingsId','setSensorPendingRemoval']:
    if legacy in s:
        raise SystemExit(f'Sensor legacy dialog setter remains: {legacy}')
old=\"\"\"  const removeSensor = (device: SensorDraftDevice) => {
    setDialog({ kind: 'remove', device });
  };

\"\"\"
if s.count(old)!=1:
    raise SystemExit(f'removeSensor dead-wrapper marker mismatch: {s.count(old)}')
s=s.replace(old,'',1)
p.write_text(s)
PYFIX

pnpm exec prettier --write \\
  apps/mobile/src/screens/hardware-setup/useToastQueue.ts \\
"""
if s.count(marker)!=1:
    raise SystemExit(f'prettier marker mismatch: {s.count(marker)}')
s=s.replace(marker,fix,1)
p.write_text(s)
PY
sh /tmp/setup-page-state-hardening-v5-inner.sh
