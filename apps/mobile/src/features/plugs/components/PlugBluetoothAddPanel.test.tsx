import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../../../app/i18n.js';
import type { VerifiedPlugBleCandidate } from '../data/plugBleOnboarding.js';
import {
  PlugBluetoothAddPanel,
  type PlugBluetoothAddPanelProps
} from './PlugBluetoothAddPanel.js';

const candidate = (state: 'needs-wifi' | 'has-wifi'): VerifiedPlugBleCandidate => ({
  bleDeviceId: 'AA:BB',
  advertisementName: 'ShellyPlugSG3-AABB',
  rssi: -40,
  physicalId: 'shellyplugsg3-aabb',
  model: 'S3PL-00112EU',
  generation: 3,
  firmwareId: '1.7.5',
  matterEnabled: false,
  network: {
    state,
    configuredSsids: state === 'has-wifi' ? ['Home'] : [],
    connectionStatus: state === 'has-wifi' ? 'got ip' : 'disconnected',
    connectedSsid: state === 'has-wifi' ? 'Home' : null,
    stationIp: state === 'has-wifi' ? '192.168.1.10' : null
  }
});
const props = (
  verifiedCandidate: VerifiedPlugBleCandidate
): PlugBluetoothAddPanelProps => ({
  scanning: false,
  candidates: [],
  inspectingDeviceId: null,
  verifiedCandidate,
  provisioning: false,
  provisionResult: null,
  error: null,
  onStart: vi.fn(),
  onStop: vi.fn(),
  onInspect: vi.fn(),
  onProvision: vi.fn(async () => undefined)
});
const renderPanel = (value: PlugBluetoothAddPanelProps) =>
  render(
    <I18nProvider>
      <PlugBluetoothAddPanel {...value} />
    </I18nProvider>
  );

describe('PlugBluetoothAddPanel', () => {
  beforeEach(() => setLocalePreference('en'));
  afterEach(() => setLocalePreference('system'));
  it('shows ephemeral Wi-Fi credentials only when the verified Plug needs Wi-Fi', async () => {
    const value = props(candidate('needs-wifi'));
    renderPanel(value);
    const ssid = screen.getByLabelText('Wi-Fi network name');
    const password = screen.getByLabelText('Wi-Fi password');
    const submit = screen.getByRole('button', { name: 'Connect to Wi-Fi' });
    expect(password).toHaveAttribute('type', 'password');
    expect(submit).toBeDisabled();
    fireEvent.change(ssid, { target: { value: 'Home network' } });
    fireEvent.change(password, { target: { value: 'secret-value' } });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(value.onProvision).toHaveBeenCalledWith('Home network', 'secret-value')
    );
    await waitFor(() => expect(password).toHaveValue(''));
  });
  it('does not show credentials when the verified Plug already has Wi-Fi', () => {
    renderPanel(props(candidate('has-wifi')));
    expect(screen.queryByLabelText('Wi-Fi network name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Wi-Fi password')).not.toBeInTheDocument();
  });
});
