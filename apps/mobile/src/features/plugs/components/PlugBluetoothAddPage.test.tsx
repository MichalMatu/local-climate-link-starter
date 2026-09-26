import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../../../app/i18n.js';
import type { SavedBlePlug } from '../data/savedBlePlug.js';
import type { VerifiedPlugBleCandidate } from '../data/plugBleOnboarding.js';
import { PlugBluetoothAddPage } from './PlugBluetoothAddPage.js';

const hoisted = vi.hoisted(() => {
  const candidate = { deviceId: 'AA:BB', name: 'ShellyPlugSG3-AABB', rssi: -40 };
  return {
    candidate,
    flowState: {
      candidates: [candidate],
      scanning: false,
      error: null as string | null,
      inspectingDeviceId: null as string | null,
      verifiedCandidates: [] as VerifiedPlugBleCandidate[],
      startScan: vi.fn(),
      stopScan: vi.fn(),
      verifyCandidate: vi.fn()
    },
    savedState: {
      plugs: [] as SavedBlePlug[],
      saveCandidate: vi.fn()
    }
  };
});

const { candidate, flowState, savedState } = hoisted;

const verified: VerifiedPlugBleCandidate = {
  bleDeviceId: candidate.deviceId,
  advertisementName: candidate.name,
  rssi: -40,
  physicalId: 'shellyplugsg3-aabb',
  model: 'S3PL-00112EU',
  generation: 3,
  firmwareId: '1.7.5',
  matterEnabled: false,
  preview: null
};
const savedPlug: SavedBlePlug = {
  physicalId: verified.physicalId,
  name: 'Kitchen',
  bleDeviceId: verified.bleDeviceId,
  advertisementName: verified.advertisementName,
  model: verified.model,
  generation: verified.generation,
  firmwareId: verified.firmwareId,
  matterEnabled: verified.matterEnabled
};

vi.mock('../flows/usePlugBleAddFlow.js', () => ({
  usePlugBleAddFlow: () => flowState
}));

vi.mock('../state/savedBlePlugStore.js', () => ({
  useSavedBlePlugStore: (selector: (state: typeof savedState) => unknown) =>
    selector(savedState)
}));

const renderPage = () =>
  render(
    <I18nProvider>
      <PlugBluetoothAddPage />
    </I18nProvider>
  );

describe('PlugBluetoothAddPage', () => {
  beforeEach(() => {
    setLocalePreference('en');
    flowState.verifiedCandidates = [];
    flowState.verifyCandidate.mockReset();
    savedState.plugs = [];
    savedState.saveCandidate.mockReset();
  });

  afterEach(() => setLocalePreference('system'));

  it('does not persist a candidate when canonical verification fails', async () => {
    flowState.verifyCandidate.mockResolvedValue(null);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: `Add: ${candidate.name}` }));

    await waitFor(() =>
      expect(flowState.verifyCandidate).toHaveBeenCalledWith(candidate)
    );
    expect(savedState.saveCandidate).not.toHaveBeenCalled();
  });

  it('persists only the verified candidate returned by canonical inspection', async () => {
    flowState.verifyCandidate.mockResolvedValue(verified);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: `Add: ${candidate.name}` }));

    await waitFor(() => expect(savedState.saveCandidate).toHaveBeenCalledWith(verified));
  });

  it('renders Added disabled for an already saved verified physical device', () => {
    flowState.verifiedCandidates = [verified];
    savedState.plugs = [savedPlug];
    renderPage();

    expect(
      screen.getByRole('button', { name: `Added: ${verified.physicalId}` })
    ).toBeDisabled();
  });
});
