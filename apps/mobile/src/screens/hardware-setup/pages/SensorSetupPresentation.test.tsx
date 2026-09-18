import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../../../app/i18n.js';
import type { SensorReadingSample } from '../../../flows/hardware-setup/sensorReadingsStore.js';
import type { SensorRuntimeReading } from '../../../flows/hardware-setup/useSensorRuntimeReadings.js';
import { SavedSensorCard } from './SensorSetupPresentation.js';

const device = {
  id: 'sensor-a4c1384f24cd',
  name: 'Xiaomi salon',
  runtimeAddress: 'A4:C1:38:4F:24:CD',
  profileId: 'xiaomi_lywsd03mmc_bthome_v2' as const
};

const sample = (seenAtMs: number): SensorReadingSample => ({
  sensorId: device.runtimeAddress,
  source: 'phone-scan',
  temperatureC: 21.3,
  humidityPct: 45.7,
  rssi: -58,
  seenAtMs
});

const card = (
  samples: readonly SensorReadingSample[],
  runtimeReading: SensorRuntimeReading | null = null
) => (
  <I18nProvider>
    <SavedSensorCard
      device={device}
      samples={samples}
      runtimeReading={runtimeReading}
      isEditing={false}
      pvvxTimePending={false}
      onEditStart={vi.fn()}
      onEditEnd={vi.fn()}
      onNameChange={vi.fn()}
      onPvvxSetTime={vi.fn()}
      onRemove={vi.fn()}
    />
  </I18nProvider>
);

describe('SavedSensorCard live sample affordance', () => {
  beforeEach(() => {
    setLocalePreference('pl');
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows the thermometer leading icon without pulsing on mount', () => {
    const { container } = render(card([sample(1000)]));
    const icon = container.querySelector('.sensor-card-leading-icon');

    expect(icon).not.toBeNull();
    expect(icon).not.toHaveClass('sensor-card-leading-icon--fresh');
  });

  it('shows compact phone live values with the phone source icon', () => {
    const { container } = render(card([sample(1000)]));
    const metrics = container.querySelector('.sensor-card-live-values__metrics');

    expect(metrics).toHaveTextContent('21.3 °C · 45.7 % · 1.38 kPa');
    expect(
      container.querySelector('.sensor-card-live-values .tabler-icon-device-mobile')
    ).not.toBeNull();
    expect(
      container.querySelector('.sensor-card-live-values .tabler-icon-plug')
    ).toBeNull();
    expect(container.querySelector('.sensor-metric-grid')).toBeNull();
  });

  it('prefers installed Shelly runtime values and source over phone samples', () => {
    const runtimeReading: SensorRuntimeReading = {
      sensorId: device.runtimeAddress,
      source: 'shelly-runtime',
      shellyName: 'Salon',
      temperatureC: 22.6,
      humidityPct: 58.4,
      vpdKpa: 1.12,
      batteryPct: 87,
      rssi: -64,
      seenAtMs: 2000,
      stale: false
    };
    const { container } = render(card([sample(1000)], runtimeReading));
    const metrics = container.querySelector('.sensor-card-live-values__metrics');

    expect(metrics).toHaveTextContent('22.6 °C · 58.4 % · 1.12 kPa');
    expect(
      container.querySelector('.sensor-card-live-values .tabler-icon-plug')
    ).not.toBeNull();
    expect(
      container.querySelector('.sensor-card-live-values .tabler-icon-device-mobile')
    ).toBeNull();
  });

  it('does not treat a Shelly discovery sample as installed runtime data', () => {
    const shellyDiscoverySample: SensorReadingSample = {
      ...sample(1000),
      source: 'shelly-scan'
    };
    const { container } = render(card([shellyDiscoverySample]));
    const metrics = container.querySelector('.sensor-card-live-values__metrics');

    expect(metrics).toHaveTextContent('— °C · — % · — kPa');
    expect(
      container.querySelector('.sensor-card-live-values .tabler-icon-plug')
    ).toBeNull();
    expect(
      container.querySelector('.sensor-card-live-values .tabler-icon-device-mobile')
    ).toBeNull();
  });

  it('pulses only when seenAtMs strictly advances', () => {
    const { container, rerender } = render(card([sample(1000)]));
    const leadingIcon = () => container.querySelector('.sensor-card-leading-icon');

    rerender(card([sample(1000)]));
    expect(leadingIcon()).not.toHaveClass('sensor-card-leading-icon--fresh');

    rerender(card([sample(999)]));
    expect(leadingIcon()).not.toHaveClass('sensor-card-leading-icon--fresh');

    rerender(card([sample(1001)]));
    expect(leadingIcon()).toHaveClass('sensor-card-leading-icon--fresh');

    act(() => vi.advanceTimersByTime(700));
    expect(leadingIcon()).not.toHaveClass('sensor-card-leading-icon--fresh');
  });

  it('pulses when the first sample arrives after an empty mounted card', () => {
    const { container, rerender } = render(card([]));
    const leadingIcon = () => container.querySelector('.sensor-card-leading-icon');

    expect(leadingIcon()).not.toHaveClass('sensor-card-leading-icon--fresh');
    rerender(card([sample(1000)]));
    expect(leadingIcon()).toHaveClass('sensor-card-leading-icon--fresh');
  });
});
