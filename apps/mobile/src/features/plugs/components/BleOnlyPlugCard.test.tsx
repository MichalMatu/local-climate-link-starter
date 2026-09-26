import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../../../app/i18n.js';
import type { SavedBlePlug } from '../data/savedBlePlug.js';
import { BleOnlyPlugCard } from './BleOnlyPlugCard.js';

const runtime = vi.hoisted(() => ({
  status: {
    relayOn: false,
    telemetry: { powerW: 4.2, voltageV: 230, energyWh: 42 },
    clock: { localTime: '12:34', timeSynced: true }
  },
  isPending: false,
  isFetching: false,
  isError: false,
  statusError: null,
  isRelayPending: false,
  isRelayError: false,
  relayError: null,
  turnRelayOn: vi.fn(),
  turnRelayOff: vi.fn()
}));

vi.mock('../flows/useSavedBlePlugRuntime.js', () => ({
  useSavedBlePlugRuntime: () => runtime
}));

const plug: SavedBlePlug = {
  physicalId: 'shellyplugsg3-demo',
  name: 'BLE lamp',
  bleDeviceId: 'BLE-LOCATOR',
  advertisementName: 'ShellyPlugSG3-Demo',
  model: 'S3PL-00112EU',
  generation: 3,
  firmwareId: '1.7.5',
  matterEnabled: false
};

const renderCard = () =>
  render(
    <I18nProvider>
      <BleOnlyPlugCard plug={plug} onNameChange={vi.fn()} />
    </I18nProvider>
  );

describe('BleOnlyPlugCard', () => {
  beforeEach(() => {
    setLocalePreference('en');
    runtime.isPending = false;
    runtime.isRelayPending = false;
    runtime.isError = false;
    runtime.isRelayError = false;
    runtime.turnRelayOn.mockReset();
    runtime.turnRelayOff.mockReset();
  });

  afterEach(() => setLocalePreference('system'));

  it('shows normalized BLE runtime status and controls the relay', () => {
    renderCard();

    expect(screen.getByText('BLE lamp')).toBeVisible();
    expect(screen.getByText('Bluetooth · S3PL-00112EU')).toBeVisible();
    expect(screen.getByText('4.2 W')).toBeVisible();
    expect(screen.getByText('230 V')).toBeVisible();
    expect(screen.getByText('42 Wh')).toBeVisible();
    expect(screen.getByText('12:34')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'ON' }));
    expect(runtime.turnRelayOn).toHaveBeenCalledOnce();
    expect(runtime.turnRelayOff).not.toHaveBeenCalled();
  });

  it('keeps pending state accessible without rendering a Refreshing footer', () => {
    runtime.isPending = true;
    runtime.isError = true;

    renderCard();

    expect(screen.queryByText('Refreshing from Shelly')).not.toBeInTheDocument();
    expect(screen.getByRole('article')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot reach Shelly');
    expect(screen.getByRole('button', { name: 'ON' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'OFF' })).toBeDisabled();
  });

  it('keeps relay mutation errors visible without a normal pending footer', () => {
    runtime.isRelayPending = true;
    runtime.isRelayError = true;

    renderCard();

    expect(screen.queryByText('Refreshing from Shelly')).not.toBeInTheDocument();
    expect(screen.getByText('Could not safely change automation state.')).toBeVisible();
  });
});
