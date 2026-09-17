from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, count))

# Reuse the existing Shelly settings / BLE / delete flow for one dashboard plug.
path = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx'
replace(
    path,
    "import { IconPlus } from '@tabler/icons-react';\nimport { useId, useState } from 'react';",
    "import { IconBluetooth, IconPlus, IconTrash } from '@tabler/icons-react';\nimport { useEffect, useId, useState } from 'react';"
)
replace(
    path,
    """type ShellySetupPageProps = HardwarePageProps<ShellySetupFlow> & {
  enableBleDiscovery?: boolean;
  addOnly?: boolean;
  onAddComplete?: () => void;
  onAddCancel?: () => void;
};
""",
    """type ShellySetupPageProps = HardwarePageProps<ShellySetupFlow> & {
  enableBleDiscovery?: boolean;
  addOnly?: boolean;
  settingsOnlyDeviceId?: string;
  onAddComplete?: () => void;
  onAddCancel?: () => void;
  onSettingsClose?: () => void;
};
"""
)
replace(
    path,
    """  enableBleDiscovery = true,
  addOnly = false,
  onAddComplete,
  onAddCancel
}: ShellySetupPageProps) => {
""",
    """  enableBleDiscovery = true,
  addOnly = false,
  settingsOnlyDeviceId,
  onAddComplete,
  onAddCancel,
  onSettingsClose
}: ShellySetupPageProps) => {
"""
)
replace(
    path,
    """  const [dialog, setDialog] = useState<ShellyDialogState>(() =>
    addOnly ? { kind: 'add' } : { kind: 'none' }
  );
""",
    """  const [dialog, setDialog] = useState<ShellyDialogState>(() =>
    addOnly
      ? { kind: 'add' }
      : settingsOnlyDeviceId
        ? { kind: 'info', deviceId: settingsOnlyDeviceId }
        : { kind: 'none' }
  );
"""
)
anchor = """  const { resetBleStopError } = useShellySetupFeedback({
    flow,
    isBleScanModalOpen,
    pushToast,
    t
  });
"""
replace(
    path,
    anchor,
    anchor + """

  useEffect(() => {
    if (!settingsOnlyDeviceId) return;
    const device = shellyDevices.find((candidate) => candidate.id === settingsOnlyDeviceId);
    if (!device) {
      onSettingsClose?.();
      return;
    }
    flow.recheckShellyMutation.reset();
    flow.recheckShellyMutation.mutate(device);
  }, [settingsOnlyDeviceId]);
"""
)
replace(
    path,
    """  const closeBleScanModal = () => {
    if (isBleDiscoveryBusy) {
      return;
    }
    flow.stopBleDiscovery();
    setDialog({ kind: 'none' });
  };
""",
    """  const closeBleScanModal = () => {
    if (isBleDiscoveryBusy) {
      return;
    }
    flow.stopBleDiscovery();
    if (settingsOnlyDeviceId && bleScanShelly) {
      setDialog({ kind: 'info', deviceId: bleScanShelly.id });
      return;
    }
    setDialog({ kind: 'none' });
  };
"""
)
replace(
    path,
    """  const closeInfoModal = () => {
    flow.recheckShellyMutation.reset();
    setDialog({ kind: 'none' });
  };
""",
    """  const closeInfoModal = () => {
    flow.recheckShellyMutation.reset();
    setDialog({ kind: 'none' });
    if (settingsOnlyDeviceId) onSettingsClose?.();
  };
"""
)
replace(
    path,
    """    flow.removeShellyDevice(shellyDevicePendingRemoval.id);
    setDialog({ kind: 'none' });
    pushToast('ok', t('hardware.shelly.removed'));
  };
""",
    """    flow.removeShellyDevice(shellyDevicePendingRemoval.id);
    setDialog({ kind: 'none' });
    pushToast('ok', t('hardware.shelly.removed'));
    if (settingsOnlyDeviceId) onSettingsClose?.();
  };
"""
)
replace(
    path,
    """      {!addOnly && (
        <button
""",
    """      {!addOnly && !settingsOnlyDeviceId && (
        <button
"""
)
replace(
    path,
    """        onClose={() => setDialog({ kind: 'none' })}
      >
        <p>{t('hardware.shelly.deleteDescription')}</p>
      </Modal>
""",
    """        onClose={() =>
          settingsOnlyDeviceId
            ? setDialog({ kind: 'info', deviceId: settingsOnlyDeviceId })
            : setDialog({ kind: 'none' })
        }
      >
        <p>{t('hardware.shelly.deleteDescription')}</p>
      </Modal>
"""
)
info_end = """              )}
          </div>
        )}
      </Modal>

      <Modal
        busy={isBleDiscoveryBusy}
"""
info_new = """              )}
            <div className=\"action-row\">
              {enableBleDiscovery && (
                <button
                  className=\"secondary-action\"
                  type=\"button\"
                  title={t('hardware.shelly.scanBleViaShellyTitle')}
                  onClick={() => openBleScanModal(infoShelly)}
                >
                  <IconBluetooth className=\"icon-action__svg\" aria-hidden=\"true\" />
                  <span>{t('hardware.shelly.scanBleViaShellyTitle')}</span>
                </button>
              )}
              <button
                className=\"secondary-action secondary-action--danger\"
                type=\"button\"
                title={t('hardware.shelly.deleteTitle')}
                onClick={() => removeSavedShelly(infoShelly)}
              >
                <IconTrash className=\"icon-action__svg\" aria-hidden=\"true\" />
                <span>{t('hardware.shelly.deleteTitle')}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        busy={isBleDiscoveryBusy}
"""
replace(path, info_end, info_new)
replace(
    path,
    """      {!addOnly && (
        <div className=\"saved-list\" aria-label={t('hardware.shelly.savedListLabel')}>
""",
    """      {!addOnly && !settingsOnlyDeviceId && (
        <div className=\"saved-list\" aria-label={t('hardware.shelly.savedListLabel')}>
"""
)

# Plain Plug card gets the familiar three-dot settings entry. The overlay mounts
# the existing hardware flow only while settings are open.
path = 'apps/mobile/src/screens/AutomationDashboardScreen.tsx'
replace(
    path,
    "import { SensorSetupPage } from './hardware-setup/pages/SensorSetupPage.js';",
    "import { SensorSetupPage } from './hardware-setup/pages/SensorSetupPage.js';\nimport { ShellySetupPage } from './hardware-setup/pages/ShellySetupPage.js';"
)
anchor = """const ThermometerDashboardSection = () => {
  const flow = useHardwareSetupFlow();
  return <SensorSetupPage flow={flow} primaryAddAction=\"phone-scan\" />;
};
"""
replace(
    path,
    anchor,
    anchor + """

const PlugSettingsOverlay = ({
  deviceId,
  onClose
}: {
  deviceId: string;
  onClose(): void;
}) => {
  const flow = useHardwareSetupFlow();
  return (
    <ShellySetupPage
      flow={flow}
      settingsOnlyDeviceId={deviceId}
      onSettingsClose={onClose}
    />
  );
};
"""
)
replace(
    path,
    """const PlainPlugCard = ({
  device,
  onAddAutomation
}: {
  device: ShellyDraftDevice;
  onAddAutomation(): void;
}) => {
""",
    """const PlainPlugCard = ({
  device,
  onAddAutomation,
  onOpenSettings
}: {
  device: ShellyDraftDevice;
  onAddAutomation(): void;
  onOpenSettings(): void;
}) => {
"""
)
replace(
    path,
    """        <div className=\"automation-card__identity\">
          <h2>{device.name}</h2>
          <p>{t('dashboard.emptyCategory')}</p>
        </div>
      </header>
""",
    """        <div className=\"automation-card__identity\">
          <h2>{device.name}</h2>
          <p>{t('dashboard.emptyCategory')}</p>
        </div>
        <button
          className=\"automation-card__menu\"
          type=\"button\"
          aria-label={`${t('hardware.shelly.settings')}: ${device.name}`}
          title={t('hardware.shelly.settings')}
          onClick={onOpenSettings}
        >
          <IconDotsVertical aria-hidden=\"true\" />
        </button>
      </header>
"""
)
replace(
    path,
    """  const [activeKind, setActiveKind] = useState<AppNavigationKind>(
    () => initialKind ?? 'climate'
  );
""",
    """  const [activeKind, setActiveKind] = useState<AppNavigationKind>(
    () => initialKind ?? 'climate'
  );
  const [settingsDeviceId, setSettingsDeviceId] = useState<string | null>(null);
"""
)
replace(
    path,
    """                <PlainPlugCard
                  key={`plug:${device.id}`}
                  device={device}
                  onAddAutomation={() => onAddAutomation('climate', device.id)}
                />
""",
    """                <PlainPlugCard
                  key={`plug:${device.id}`}
                  device={device}
                  onAddAutomation={() => onAddAutomation('climate', device.id)}
                  onOpenSettings={() => setSettingsDeviceId(device.id)}
                />
"""
)
insert = """      {activeKind === 'climate' && (
        <button
          className=\"dashboard-fab\"
"""
replace(
    path,
    insert,
    """      {settingsDeviceId && (
        <PlugSettingsOverlay
          key={settingsDeviceId}
          deviceId={settingsDeviceId}
          onClose={() => setSettingsDeviceId(null)}
        />
      )}

      {activeKind === 'climate' && (
        <button
          className=\"dashboard-fab\"
"""
)

# Regression test: three-dot settings exposes BLE scan and delete for the exact plug.
path = 'apps/mobile/src/__tests__/automation-dashboard.test.tsx'
anchor = """    expect(within(plugCard).getByText('09:48')).toBeVisible();

    const onButton = within(plugCard).getByRole('button', { name: 'ON' });
"""
replace(
    path,
    anchor,
    """    expect(within(plugCard).getByText('09:48')).toBeVisible();

    fireEvent.click(
      within(plugCard).getByRole('button', { name: 'Ustawienia gniazdka: Nawilżacz' })
    );
    const settingsDialog = await screen.findByRole('dialog', { name: 'Nawilżacz' });
    expect(
      within(settingsDialog).getByRole('button', {
        name: 'Skanuj termometry BLE przez to gniazdko'
      })
    ).toBeVisible();
    expect(
      within(settingsDialog).getByRole('button', {
        name: 'Usuń gniazdko tylko z aplikacji'
      })
    ).toBeVisible();
    fireEvent.click(within(settingsDialog).getByRole('button', { name: 'Zamknij' }));

    const onButton = within(plugCard).getByRole('button', { name: 'ON' });
"""
)
