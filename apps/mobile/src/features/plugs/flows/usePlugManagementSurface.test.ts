import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  usePlugManagementSurface,
  type UsePlugManagementSurfaceOptions
} from './usePlugManagementSurface.js';

type Device = { id: string; name: string };

const device: Device = { id: 'plug-1', name: 'Tent plug' };

const createOptions = (): UsePlugManagementSurfaceOptions<Device> => ({
  devices: [device],
  settingsOnlyDeviceId: undefined,
  bleScanOnlyDeviceId: undefined,
  bleBusy: false,
  onSettingsPageRequest: undefined,
  onBleScanPageRequest: undefined,
  onSettingsClose: undefined,
  onBleScanClose: undefined,
  resetPlugCheck: vi.fn(),
  resetSettingsCheck: vi.fn(),
  recheckSettings: vi.fn(),
  resetBleDiscovery: vi.fn(),
  beforeBleStart: vi.fn(),
  startBleDiscovery: vi.fn(),
  stopBleDiscovery: vi.fn(),
  removeDevice: vi.fn(),
  onDeviceRemoved: vi.fn()
});

describe('usePlugManagementSurface', () => {
  it('owns settings-only entry and closes an invalid target', () => {
    const options = createOptions();
    options.settingsOnlyDeviceId = device.id;
    const { result, unmount } = renderHook(() => usePlugManagementSurface(options));

    expect(options.resetSettingsCheck).toHaveBeenCalledTimes(1);
    expect(options.recheckSettings).toHaveBeenCalledWith(device);
    expect(result.current.infoDevice).toEqual(device);
    unmount();

    const missing = createOptions();
    missing.settingsOnlyDeviceId = 'missing';
    missing.onSettingsClose = vi.fn();
    renderHook(() => usePlugManagementSurface(missing));
    expect(missing.onSettingsClose).toHaveBeenCalledTimes(1);
  });

  it('owns BLE-only start and cleanup without knowing the transport', () => {
    const options = createOptions();
    options.bleScanOnlyDeviceId = device.id;
    const { result, unmount } = renderHook(() => usePlugManagementSurface(options));

    expect(options.resetBleDiscovery).toHaveBeenCalledTimes(1);
    expect(options.beforeBleStart).toHaveBeenCalledTimes(1);
    expect(options.startBleDiscovery).toHaveBeenCalledWith(device);
    expect(result.current.bleScanOnlyDevice).toEqual(device);

    unmount();
    expect(options.stopBleDiscovery).toHaveBeenCalledTimes(1);
  });

  it('delegates child-page navigation instead of starting local surfaces', () => {
    const options = createOptions();
    options.onSettingsPageRequest = vi.fn();
    options.onBleScanPageRequest = vi.fn();
    const { result } = renderHook(() => usePlugManagementSurface(options));

    act(() => result.current.openInfo(device));
    expect(options.resetPlugCheck).toHaveBeenCalledTimes(1);
    expect(options.resetSettingsCheck).toHaveBeenCalledTimes(1);
    expect(options.onSettingsPageRequest).toHaveBeenCalledWith(device);
    expect(options.recheckSettings).not.toHaveBeenCalled();

    act(() => result.current.openBleScan(device));
    expect(options.onBleScanPageRequest).toHaveBeenCalledWith(device);
    expect(options.startBleDiscovery).not.toHaveBeenCalled();
  });

  it('owns local settings and BLE modal transitions', () => {
    const options = createOptions();
    const { result } = renderHook(() => usePlugManagementSurface(options));

    act(() => result.current.openInfo(device));
    expect(result.current.infoDevice).toEqual(device);
    expect(options.recheckSettings).toHaveBeenCalledWith(device);

    act(() => result.current.openBleScan(device));
    expect(result.current.isBleModalOpen).toBe(true);
    expect(options.resetBleDiscovery).toHaveBeenCalledTimes(1);
    expect(options.beforeBleStart).toHaveBeenCalledTimes(1);
    expect(options.startBleDiscovery).toHaveBeenCalledWith(device);

    act(() => result.current.closeBleScan());
    expect(options.stopBleDiscovery).toHaveBeenCalledTimes(1);
    expect(result.current.isBleModalOpen).toBe(false);
  });

  it('owns remove confirmation state while delegating the durable mutation', () => {
    const options = createOptions();
    const { result } = renderHook(() => usePlugManagementSurface(options));

    act(() => result.current.requestRemove(device));
    expect(result.current.removePendingDevice).toEqual(device);

    act(() => result.current.confirmRemove());
    expect(options.removeDevice).toHaveBeenCalledWith(device.id);
    expect(options.onDeviceRemoved).toHaveBeenCalledWith(device);
    expect(result.current.removePendingDevice).toBeNull();
  });
});
