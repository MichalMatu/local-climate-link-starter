import { useEffect, useRef, useState } from 'react';

export type PlugManagementDevice = {
  id: string;
  name: string;
};

type PlugManagementDialog<TDevice extends PlugManagementDevice> =
  | { kind: 'none' }
  | { kind: 'ble'; device: TDevice }
  | { kind: 'info'; deviceId: string }
  | { kind: 'remove'; device: TDevice };

export type UsePlugManagementSurfaceOptions<TDevice extends PlugManagementDevice> = {
  devices: readonly TDevice[];
  settingsOnlyDeviceId: string | undefined;
  bleScanOnlyDeviceId: string | undefined;
  bleBusy: boolean;
  onSettingsPageRequest: ((device: TDevice) => void) | undefined;
  onBleScanPageRequest: ((device: TDevice) => void) | undefined;
  onSettingsClose: (() => void) | undefined;
  onBleScanClose: (() => void) | undefined;
  resetPlugCheck(): void;
  resetSettingsCheck(): void;
  recheckSettings(device: TDevice): void;
  resetBleDiscovery(): void;
  beforeBleStart?(): void;
  startBleDiscovery(device: TDevice): void;
  stopBleDiscovery(): void;
  removeDevice(deviceId: string): void;
  onDeviceRemoved?(device: TDevice): void;
};

export function usePlugManagementSurface<TDevice extends PlugManagementDevice>(
  options: UsePlugManagementSurfaceOptions<TDevice>
) {
  const latest = useRef(options);
  latest.current = options;
  const [dialog, setDialog] = useState<PlugManagementDialog<TDevice>>(() =>
    options.settingsOnlyDeviceId
      ? { kind: 'info', deviceId: options.settingsOnlyDeviceId }
      : { kind: 'none' }
  );

  const infoDevice =
    dialog.kind === 'info'
      ? (options.devices.find((device) => device.id === dialog.deviceId) ?? null)
      : null;
  const bleModalDevice = dialog.kind === 'ble' ? dialog.device : null;
  const removePendingDevice = dialog.kind === 'remove' ? dialog.device : null;
  const bleScanOnlyDevice =
    options.bleScanOnlyDeviceId == null
      ? null
      : (options.devices.find((device) => device.id === options.bleScanOnlyDeviceId) ??
        null);
  const isBleModalOpen = dialog.kind === 'ble';
  const isBleDiscoverySurfaceOpen =
    isBleModalOpen || Boolean(options.bleScanOnlyDeviceId);

  useEffect(() => {
    if (!options.settingsOnlyDeviceId) return;
    const current = latest.current;
    const device = current.devices.find(
      (candidate) => candidate.id === options.settingsOnlyDeviceId
    );
    if (!device) {
      current.onSettingsClose?.();
      return;
    }
    current.resetSettingsCheck();
    current.recheckSettings(device);
  }, [options.settingsOnlyDeviceId]);

  useEffect(() => {
    if (!options.bleScanOnlyDeviceId) return undefined;
    const current = latest.current;
    const device = current.devices.find(
      (candidate) => candidate.id === options.bleScanOnlyDeviceId
    );
    if (!device) {
      current.onBleScanClose?.();
      return undefined;
    }
    current.resetBleDiscovery();
    current.beforeBleStart?.();
    current.startBleDiscovery(device);
    return () => latest.current.stopBleDiscovery();
  }, [options.bleScanOnlyDeviceId]);

  const openInfo = (device: TDevice) => {
    const current = latest.current;
    current.resetPlugCheck();
    current.resetSettingsCheck();
    if (current.onSettingsPageRequest) {
      current.onSettingsPageRequest(device);
      return;
    }
    setDialog({ kind: 'info', deviceId: device.id });
    current.recheckSettings(device);
  };

  const closeInfo = () => {
    const current = latest.current;
    current.resetSettingsCheck();
    setDialog({ kind: 'none' });
    if (current.settingsOnlyDeviceId) current.onSettingsClose?.();
  };

  const openBleScan = (device: TDevice) => {
    const current = latest.current;
    if (current.onBleScanPageRequest) {
      current.onBleScanPageRequest(device);
      return;
    }
    current.resetBleDiscovery();
    current.beforeBleStart?.();
    setDialog({ kind: 'ble', device });
    current.startBleDiscovery(device);
  };

  const closeBleScan = () => {
    const current = latest.current;
    if (current.bleBusy) return;
    current.stopBleDiscovery();
    if (current.settingsOnlyDeviceId && bleModalDevice) {
      setDialog({ kind: 'info', deviceId: bleModalDevice.id });
      return;
    }
    setDialog({ kind: 'none' });
  };

  const requestRemove = (device: TDevice) => {
    setDialog({ kind: 'remove', device });
  };

  const cancelRemove = () => {
    const current = latest.current;
    setDialog(
      current.settingsOnlyDeviceId
        ? { kind: 'info', deviceId: current.settingsOnlyDeviceId }
        : { kind: 'none' }
    );
  };

  const confirmRemove = () => {
    if (!removePendingDevice) return;
    const current = latest.current;
    current.removeDevice(removePendingDevice.id);
    setDialog({ kind: 'none' });
    current.onDeviceRemoved?.(removePendingDevice);
    if (current.settingsOnlyDeviceId) current.onSettingsClose?.();
  };

  return {
    infoDevice,
    bleModalDevice,
    bleScanOnlyDevice,
    removePendingDevice,
    isBleModalOpen,
    isBleDiscoverySurfaceOpen,
    openInfo,
    closeInfo,
    openBleScan,
    closeBleScan,
    requestRemove,
    cancelRemove,
    confirmRemove
  };
}
