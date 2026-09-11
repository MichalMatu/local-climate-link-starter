#!/usr/bin/env sh
set -eu

BRANCH=work/production-readiness-hardening-20260911
EXPECTED=3d32e7f6402695db16b8ba71b6aafe259971b83a
git fetch --prune origin "$BRANCH" >/dev/null
test "$(git rev-parse "origin/$BRANCH")" = "$EXPECTED"
git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null
test -z "$(git status --porcelain)"

cat > apps/mobile/src/screens/hardware-setup/useToastQueue.ts <<'EOF'
import { useCallback, useRef, useState } from 'react';
import type { ToastMessage, ToastTone } from '@lcl/ui';

export const useToastQueue = (idPrefix: string) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const dismissToastsWhere = useCallback(
    (predicate: (toast: ToastMessage) => boolean) => {
      setToasts((current) => current.filter((toast) => !predicate(toast)));
    },
    []
  );

  const pushToast = useCallback(
    (tone: ToastTone, title: string, detail?: string) => {
      toastIdRef.current += 1;
      const id = `${idPrefix}-${toastIdRef.current}`;
      const toast: ToastMessage =
        detail === undefined ? { id, tone, title } : { id, tone, title, detail };
      setToasts((current) => [...current.slice(-2), toast]);
    },
    [idPrefix]
  );

  return { dismissToast, dismissToastsWhere, pushToast, toasts };
};
EOF

python3 - <<'PY'
from pathlib import Path

# Shelly page: one discriminated dialog state replaces twelve correlated modal states.
p=Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
s=p.read_text()
s=s.replace('  ToastViewport,\n  type ToastMessage,\n  type ToastTone\n', '  ToastViewport\n')
s=s.replace("import { mutationError, shellyAddressLabel, type HardwarePageProps } from '../helpers.js';\n", "import { mutationError, shellyAddressLabel, type HardwarePageProps } from '../helpers.js';\nimport { useToastQueue } from '../useToastQueue.js';\n")
marker="type ShellyStatusModalSource = 'add' | 'recheck';\n"
insert="""type ShellyStatusModalSource = 'add' | 'recheck';
type ShellyDialogState =
  | { kind: 'none' }
  | { kind: 'add' }
  | { kind: 'scan'; returnToAdd: boolean }
  | {
      kind: 'status';
      address: string | null;
      source: ShellyStatusModalSource;
      returnSettingsId: string | null;
    }
  | { kind: 'ble'; device: ShellyDraftDevice }
  | { kind: 'settings'; deviceId: string }
  | { kind: 'clock'; deviceId: string }
  | { kind: 'remove'; device: ShellyDraftDevice };
"""
if s.count(marker)!=1: raise SystemExit('Shelly type marker mismatch')
s=s.replace(marker,insert,1)
old="""  const [isAddShellyModalOpen, setIsAddShellyModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isBleScanModalOpen, setIsBleScanModalOpen] = useState(false);
  const [bleScanShelly, setBleScanShelly] = useState<ShellyDraftDevice | null>(null);
  const [settingsShellyId, setSettingsShellyId] = useState<string | null>(null);
  const [clockShellyId, setClockShellyId] = useState<string | null>(null);
  const [shellyDevicePendingRemoval, setShellyDevicePendingRemoval] =
    useState<ShellyDraftDevice | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [statusModalAddress, setStatusModalAddress] = useState<string | null>(null);
  const [statusModalSource, setStatusModalSource] =
    useState<ShellyStatusModalSource>('add');
  const [statusModalReturnSettingsId, setStatusModalReturnSettingsId] = useState<
    string | null
  >(null);
  const [didSubmitShellyAdd, setDidSubmitShellyAdd] = useState(false);
  const [didSubmitShellyScan, setDidSubmitShellyScan] = useState(false);
"""
new="""  const [dialog, setDialog] = useState<ShellyDialogState>({ kind: 'none' });
  const [didSubmitShellyAdd, setDidSubmitShellyAdd] = useState(false);
  const [didSubmitShellyScan, setDidSubmitShellyScan] = useState(false);
  const { dismissToast, dismissToastsWhere, pushToast, toasts } =
    useToastQueue('shelly-toast');
  const isAddShellyModalOpen = dialog.kind === 'add';
  const isStatusModalOpen = dialog.kind === 'status';
  const isScanModalOpen = dialog.kind === 'scan';
  const isBleScanModalOpen = dialog.kind === 'ble';
  const bleScanShelly = dialog.kind === 'ble' ? dialog.device : null;
  const settingsShellyId = dialog.kind === 'settings' ? dialog.deviceId : null;
  const clockShellyId = dialog.kind === 'clock' ? dialog.deviceId : null;
  const shellyDevicePendingRemoval = dialog.kind === 'remove' ? dialog.device : null;
  const statusModalAddress = dialog.kind === 'status' ? dialog.address : null;
  const statusModalSource = dialog.kind === 'status' ? dialog.source : 'add';
  const statusModalReturnSettingsId =
    dialog.kind === 'status' ? dialog.returnSettingsId : null;
  const returnToAddAfterScan = dialog.kind === 'scan' && dialog.returnToAdd;
"""
if s.count(old)!=1: raise SystemExit('Shelly state block mismatch')
s=s.replace(old,new,1)
s=s.replace('  const toastIdRef = useRef(0);\n','')
s=s.replace('  const [returnToAddAfterScan, setReturnToAddAfterScan] = useState(false);\n','')
old="""  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((tone: ToastTone, title: string, detail?: string) => {
    toastIdRef.current += 1;
    const id = `shelly-toast-${toastIdRef.current}`;
    const toast: ToastMessage =
      detail === undefined ? { id, tone, title } : { id, tone, title, detail };
    setToasts((current) => [...current.slice(-2), toast]);
  }, []);

"""
if s.count(old)!=1: raise SystemExit('Shelly toast block mismatch')
s=s.replace(old,'',1)
s=s.replace("    setToasts((current) => current.filter((toast) => toast.title !== scanningTitle));", "    dismissToastsWhere((toast) => toast.title === scanningTitle);")
s=s.replace('  }, [t]);\n\n  const dismissShellyScanToasts', '  }, [dismissToastsWhere, t]);\n\n  const dismissShellyScanToasts',1)
s=s.replace("    setToasts((current) => current.filter((toast) => !scanTitles.has(toast.title)));", "    dismissToastsWhere((toast) => scanTitles.has(toast.title));")
s=s.replace('  }, [t]);\n\n  useEffect(() => {', '  }, [dismissToastsWhere, t]);\n\n  useEffect(() => {',1)
repls={
"    setIsAddShellyModalOpen(true);":"    setDialog({ kind: 'add' });",
"    setIsAddShellyModalOpen(false);":"    setDialog({ kind: 'none' });",
"    setReturnToAddAfterScan(true);\n    setIsAddShellyModalOpen(false);\n    setIsScanModalOpen(true);":"    setDialog({ kind: 'scan', returnToAdd: true });",
"    setIsScanModalOpen(false);\n    if (shouldReturnToAdd) {\n      setIsAddShellyModalOpen(true);\n      setReturnToAddAfterScan(false);\n      return;\n    }\n    setReturnToAddAfterScan(false);":"    setDialog(shouldReturnToAdd ? { kind: 'add' } : { kind: 'none' });",
"    setBleScanShelly(device);\n    setIsBleScanModalOpen(true);":"    setDialog({ kind: 'ble', device });",
"    setIsBleScanModalOpen(false);":"    setDialog({ kind: 'none' });",
"    setStatusModalAddress(device.baseUrl);\n    setStatusModalSource('recheck');\n    setStatusModalReturnSettingsId(options.returnToSettings ? device.id : null);\n    setIsStatusModalOpen(true);":"    setDialog({\n      kind: 'status',\n      address: device.baseUrl,\n      source: 'recheck',\n      returnSettingsId: options.returnToSettings ? device.id : null\n    });",
"      onSuccess: () => setIsStatusModalOpen(true)":"      onSuccess: () => undefined",
"    setShellyDevicePendingRemoval(device);":"    setDialog({ kind: 'remove', device });",
"    setSettingsShellyId(device.id);":"    setDialog({ kind: 'settings', deviceId: device.id });",
"    setSettingsShellyId(null);":"    setDialog({ kind: 'none' });",
"    setClockShellyId(device.id);":"    setDialog({ kind: 'clock', deviceId: device.id });",
"    setClockShellyId(null);":"    setDialog({ kind: 'none' });",
"    setShellyDevicePendingRemoval(null);":"    setDialog({ kind: 'none' });",
"        setSettingsShellyId(statusModalReturnSettingsId);":"        setDialog({ kind: 'settings', deviceId: statusModalReturnSettingsId });",
"      setStatusModalReturnSettingsId(null);":"      return;",
"    setIsStatusModalOpen(false);":"    setDialog({ kind: 'none' });",
"        onClose={() => setShellyDevicePendingRemoval(null)}":"        onClose={() => setDialog({ kind: 'none' })}"
}
for a,b in repls.items():
    if a not in s: raise SystemExit(f'Shelly replacement missing: {a[:60]}')
    s=s.replace(a,b,1)
p.write_text(s)

# Rule page: one active dialog enum + shared toast queue.
p=Path('apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx')
s=p.read_text()
s=s.replace('  ToastViewport,\n  type ToastMessage,\n  type ToastTone\n', '  ToastViewport\n')
s=s.replace("} from '../../../flows/hardware-setup/ruleAdvancedSettings.js';\n", "} from '../../../flows/hardware-setup/ruleAdvancedSettings.js';\nimport { useToastQueue } from '../useToastQueue.js';\n")
marker='type RuleControlCopy = {\n'
insert="type RuleDialogState = 'none' | 'script' | 'advanced' | 'delete' | 'install-block' | 'relay-test';\n\n"
if marker not in s: raise SystemExit('Rule type marker missing')
s=s.replace(marker,insert+marker,1)
old="""  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [isInstallBlockModalOpen, setIsInstallBlockModalOpen] = useState(false);
  const [isRelayTestModalOpen, setIsRelayTestModalOpen] = useState(false);
"""
new="""  const [dialog, setDialog] = useState<RuleDialogState>('none');
  const { dismissToast, pushToast, toasts } = useToastQueue('rule-toast');
"""
if s.count(old)!=1: raise SystemExit('Rule state block mismatch')
s=s.replace(old,new,1)
s=s.replace('  const toastIdRef = useRef(0);\n','')
old="""  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((tone: ToastTone, title: string, detail?: string) => {
    toastIdRef.current += 1;
    const id = `rule-toast-${toastIdRef.current}`;
    const toast: ToastMessage =
      detail === undefined ? { id, tone, title } : { id, tone, title, detail };
    setToasts((current) => [...current.slice(-2), toast]);
  }, []);

"""
if s.count(old)!=1: raise SystemExit('Rule toast block mismatch')
s=s.replace(old,'',1)
repls={
"    setIsDeleteConfirmModalOpen(false);":"    if (dialog === 'delete') setDialog('none');",
"    setIsInstallBlockModalOpen(true);":"    setDialog('install-block');",
"    setIsRelayTestModalOpen(true);":"    setDialog('relay-test');",
"    setIsRelayTestModalOpen(false);":"    setDialog('none');",
"    setIsAdvancedModalOpen(true);":"    setDialog('advanced');",
"    setIsAdvancedModalOpen(false);":"    setDialog('none');",
"                onClick={() => setIsScriptModalOpen(true)}":"                onClick={() => setDialog('script')}",
"                onClick={() => setIsDeleteConfirmModalOpen(true)}":"                onClick={() => setDialog('delete')}",
"        open={isInstallBlockModalOpen && flow.installMutation.isError}":"        open={dialog === 'install-block' && flow.installMutation.isError}",
"          setIsInstallBlockModalOpen(false);":"          setDialog('none');",
"        open={isRelayTestModalOpen && flow.canRunSafeRelayTest}":"        open={dialog === 'relay-test' && flow.canRunSafeRelayTest}",
"        open={isScriptModalOpen && flow.configState.ok}":"        open={dialog === 'script' && flow.configState.ok}",
"        onClose={() => setIsScriptModalOpen(false)}":"        onClose={() => setDialog('none')}",
"        open={isDeleteConfirmModalOpen}":"        open={dialog === 'delete'}",
"            setIsDeleteConfirmModalOpen(false);":"            setDialog('none');",
"        open={isAdvancedModalOpen}":"        open={dialog === 'advanced'}",
"        onClose={() => setIsAdvancedModalOpen(false)}":"        onClose={() => setDialog('none')}"
}
for a,b in repls.items():
    if a not in s: raise SystemExit(f'Rule replacement missing: {a[:60]}')
    s=s.replace(a,b,1)
# selected Shelly effect now depends on dialog.
s=s.replace('  }, [flow.selectedShellyId]);','  }, [dialog, flow.selectedShellyId]);',1)
p.write_text(s)

# Sensor page: one discriminated dialog state + shared toast queue.
p=Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx')
s=p.read_text()
s=s.replace('  ToastViewport,\n  type ToastMessage,\n  type ToastTone\n', '  ToastViewport\n')
s=s.replace("import { mutationError, type HardwarePageProps } from '../helpers.js';\n", "import { mutationError, type HardwarePageProps } from '../helpers.js';\nimport { useToastQueue } from '../useToastQueue.js';\n")
marker='export const SensorSetupPage = ({ flow }: HardwarePageProps<SensorSetupFlow>) => {\n'
insert="""type SensorDialogState =
  | { kind: 'none' }
  | { kind: 'add' }
  | { kind: 'ble' }
  | { kind: 'settings'; deviceId: string }
  | { kind: 'remove'; device: SensorDraftDevice };

"""
if marker not in s: raise SystemExit('Sensor page marker missing')
s=s.replace(marker,insert+marker,1)
old="""  const [isAddSensorModalOpen, setIsAddSensorModalOpen] = useState(false);
  const [isPhoneBleScanModalOpen, setIsPhoneBleScanModalOpen] = useState(false);
  const [sensorSettingsId, setSensorSettingsId] = useState<string | null>(null);
  const [sensorPendingRemoval, setSensorPendingRemoval] =
    useState<SensorDraftDevice | null>(null);
  const [didSubmitSensorAdd, setDidSubmitSensorAdd] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);
"""
new="""  const [dialog, setDialog] = useState<SensorDialogState>({ kind: 'none' });
  const [didSubmitSensorAdd, setDidSubmitSensorAdd] = useState(false);
  const { dismissToast, pushToast, toasts } = useToastQueue('sensor-toast');
  const isAddSensorModalOpen = dialog.kind === 'add';
  const isPhoneBleScanModalOpen = dialog.kind === 'ble';
  const sensorSettingsId = dialog.kind === 'settings' ? dialog.deviceId : null;
  const sensorPendingRemoval = dialog.kind === 'remove' ? dialog.device : null;
"""
if s.count(old)!=1: raise SystemExit('Sensor state block mismatch')
s=s.replace(old,new,1)
old="""  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((tone: ToastTone, title: string, detail?: string) => {
    toastIdRef.current += 1;
    const id = `sensor-toast-${toastIdRef.current}`;
    const toast: ToastMessage =
      detail === undefined ? { id, tone, title } : { id, tone, title, detail };
    setToasts((current) => [...current.slice(-2), toast]);
  }, []);

"""
if s.count(old)!=1: raise SystemExit('Sensor toast block mismatch')
s=s.replace(old,'',1)
repls={
"    setIsAddSensorModalOpen(false);":"    setDialog({ kind: 'none' });",
"    setIsPhoneBleScanModalOpen(false);":"    setDialog({ kind: 'none' });",
"    setIsAddSensorModalOpen(true);":"    setDialog({ kind: 'add' });",
"    setIsAddSensorModalOpen(false);\n    setIsPhoneBleScanModalOpen(true);":"    setDialog({ kind: 'ble' });",
"    setSensorPendingRemoval(device);":"    setDialog({ kind: 'remove', device });",
"    setSensorSettingsId((current) =>\n      current === sensorPendingRemoval.id ? null : current\n    );\n    setSensorPendingRemoval(null);":"    setDialog({ kind: 'none' });",
"    setSensorSettingsId(device.id);":"    setDialog({ kind: 'settings', deviceId: device.id });",
"    setSensorSettingsId(null);\n    removeSensor(device);":"    setDialog({ kind: 'remove', device });",
"        onClose={() => setSensorSettingsId(null)}":"        onClose={() => setDialog({ kind: 'none' })}",
"        onClose={() => setSensorPendingRemoval(null)}":"        onClose={() => setDialog({ kind: 'none' })}"
}
for a,b in repls.items():
    if a not in s: raise SystemExit(f'Sensor replacement missing: {a[:60]}')
    s=s.replace(a,b,1)
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/useToastQueue.ts \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile lint
pnpm --filter @lcl/mobile test -- --runInBand || pnpm --filter @lcl/mobile test
pnpm quality:ux
pnpm quality:repo
pnpm check:full
git diff --check
git status --short
git add apps/mobile/src/screens/hardware-setup/useToastQueue.ts apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx
git commit -m "refactor(mobile): unify setup page dialog state"
git push origin "$BRANCH"
echo "SETUP_PAGE_STATE_HARDENING_SHA=$(git rev-parse HEAD)"
echo "SHELLY_STATE_COUNT=$(grep -o 'useState' apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx | wc -l | tr -d ' ')"
echo "RULE_STATE_COUNT=$(grep -o 'useState' apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx | wc -l | tr -d ' ')"
echo "SENSOR_STATE_COUNT=$(grep -o 'useState' apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx | wc -l | tr -d ' ')"
echo 'SETUP_PAGE_STATE_HARDENING_OK=1'
