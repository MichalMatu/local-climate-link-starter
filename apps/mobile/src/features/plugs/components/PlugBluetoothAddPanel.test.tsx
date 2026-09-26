import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../../../app/i18n.js';
import type { VerifiedPlugBleCandidate } from '../data/plugBleOnboarding.js';
import {
  PlugBluetoothAddPanel,
  type PlugBluetoothAddPanelProps
} from './PlugBluetoothAddPanel.js';

const candidate = {
  deviceId: 'AA:BB',
  name: 'ShellyPlugSG3-AABB',
  rssi: -40
};

const verifiedCandidate: VerifiedPlugBleCandidate = {
  bleDeviceId: candidate.deviceId,
  advertisementName: candidate.name,
  rssi: -40,
  physicalId: 'shellyplugsg3-aabb',
  model: 'S3PL-00112EU',
  generation: 3,
  firmwareId: '1.7.5',
  matterEnabled: false,
  preview: {
    relayOn: false,
    powerW: 4.2,
    voltageV: 230,
    currentA: 0.02,
    localTime: '12:34'
  }
};

const renderPanel = (overrides: Partial<PlugBluetoothAddPanelProps> = {}) => {
  const props: PlugBluetoothAddPanelProps = {
    scanning: false,
    candidates: [],
    inspectingDeviceId: null,
    verifiedCandidates: [],
    savedPhysicalIds: [],
    error: null,
    onStart: vi.fn(),
    onStop: vi.fn(),
    onAdd: vi.fn(),
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

  it('presents Add directly on every candidate without an Info step', () => {
    const props = renderPanel({ candidates: [candidate] });

    expect(screen.queryByRole('button', { name: `Info: ${candidate.name}` })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: `Add: ${candidate.name}` }));

    expect(props.onAdd).toHaveBeenCalledWith(candidate);
  });

  it('renders canonical metadata and read-only preview after verification', () => {
    renderPanel({ candidates: [candidate], verifiedCandidates: [verifiedCandidate] });

    expect(screen.getByText(verifiedCandidate.physicalId)).toBeVisible();
    expect(screen.getByText('S3PL-00112EU, gen 3')).toBeVisible();
    expect(screen.getByText('4.2 W')).toBeVisible();
    expect(screen.getByText('230 V')).toBeVisible();
    expect(screen.getByText('0.02 A')).toBeVisible();
    expect(screen.getByText('12:34')).toBeVisible();
  });

  it('shows Added disabled only after canonical physical identity is saved', () => {
    renderPanel({
      candidates: [candidate],
      verifiedCandidates: [verifiedCandidate],
      savedPhysicalIds: [verifiedCandidate.physicalId]
    });

    expect(
      screen.getByRole('button', { name: `Added: ${verifiedCandidate.physicalId}` })
    ).toBeDisabled();
  });

  it('keeps Add available when preview failed after successful identity verification', () => {
    renderPanel({
      candidates: [candidate],
      verifiedCandidates: [{ ...verifiedCandidate, preview: null }]
    });

    expect(
      screen.getByRole('button', { name: `Add: ${verifiedCandidate.physicalId}` })
    ).toBeEnabled();
    expect(screen.getAllByText('—')).toHaveLength(4);
  });
});
