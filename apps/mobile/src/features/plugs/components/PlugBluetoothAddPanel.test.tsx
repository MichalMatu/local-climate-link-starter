import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../../../app/i18n.js';
import type { VerifiedPlugBleCandidate } from '../data/plugBleOnboarding.js';
import {
  PlugBluetoothAddPanel,
  type PlugBluetoothAddPanelProps
} from './PlugBluetoothAddPanel.js';

const verifiedCandidate: VerifiedPlugBleCandidate = {
  bleDeviceId: 'AA:BB',
  advertisementName: 'ShellyPlugSG3-AABB',
  rssi: -40,
  physicalId: 'shellyplugsg3-aabb',
  model: 'S3PL-00112EU',
  generation: 3,
  firmwareId: '1.7.5',
  matterEnabled: false
};

const renderPanel = (overrides: Partial<PlugBluetoothAddPanelProps> = {}) => {
  const props: PlugBluetoothAddPanelProps = {
    scanning: false,
    candidates: [],
    inspectingDeviceId: null,
    verifiedCandidate: null,
    verifiedCandidateSaved: false,
    error: null,
    onStart: vi.fn(),
    onStop: vi.fn(),
    onInspect: vi.fn(),
    onSaveVerified: vi.fn(),
    ...overrides
  };
  render(
    <I18nProvider>
      <PlugBluetoothAddPanel {...props} />
    </I18nProvider>
  );
  return props;
};

describe('PlugBluetoothAddPanel', () => {
  beforeEach(() => setLocalePreference('en'));
  afterEach(() => setLocalePreference('system'));

  it('shows verified physical identity without any Wi-Fi provisioning controls', () => {
    renderPanel({ verifiedCandidate });

    expect(screen.getByText('shellyplugsg3-aabb')).toBeInTheDocument();
    expect(screen.getByText('S3PL-00112EU, gen 3')).toBeInTheDocument();
    expect(screen.queryByLabelText('Wi-Fi network name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Wi-Fi password')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect to Wi-Fi' })).not.toBeInTheDocument();
  });

  it('passes the selected advertisement to identity inspection', () => {
    const candidate = {
      deviceId: 'AA:BB',
      name: 'ShellyPlugSG3-AABB',
      rssi: -40
    };
    const props = renderPanel({ candidates: [candidate] });

    fireEvent.click(screen.getByRole('button', { name: `Info: ${candidate.name}` }));

    expect(props.onInspect).toHaveBeenCalledWith(candidate);
  });

  it('saves a verified BLE-only plug and exposes the persisted state', () => {
    const props = renderPanel({ verifiedCandidate });

    fireEvent.click(
      screen.getByRole('button', { name: `Add: ${verifiedCandidate.physicalId}` })
    );

    expect(props.onSaveVerified).toHaveBeenCalledTimes(1);
  });

  it('disables saving when the verified physical device is already stored', () => {
    renderPanel({ verifiedCandidate, verifiedCandidateSaved: true });

    expect(
      screen.getByRole('button', { name: `Added: ${verifiedCandidate.physicalId}` })
    ).toBeDisabled();
  });
});
