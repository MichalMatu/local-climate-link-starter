import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bleDiscoveryCandidateSchema } from '../../hardware-setup/schemas.js';
import { useHardwareSetupReadingsStore } from '../../hardware-setup/sensorReadingsStore.js';
import { useSensorStore, useRuleStore } from '../../registry/devicesAndRules.js';
import { climate, sensor } from '../../registry/fixtures.test-support.js';
import { useSensorManagementFlow } from './useSensorManagementFlow.js';

const clients: QueryClient[] = [];
const renderFlow = () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  clients.push(client);
  const wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(useSensorManagementFlow, { wrapper });
};
const candidate = bleDiscoveryCandidateSchema.parse({
  a: sensor.runtimeAddress,
  p: 'x',
  t: 21.5,
  h: 45,
  r: -60
});

beforeEach(() => {
  localStorage.clear();
  useSensorStore.setState({ items: [], loadError: null });
  useRuleStore.setState({ items: [], loadError: null });
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  useSensorStore.setState({ items: [], loadError: null });
  useRuleStore.setState({ items: [], loadError: null });
  useHardwareSetupReadingsStore.getState().clearSensorReadings(sensor.runtimeAddress);
});

describe('independent thermometer management', () => {
  it('saves discovery by profile/address identity and keeps readings separate', () => {
    const { result } = renderFlow();
    act(() => {
      expect(result.current.addDiscoveredSensor(candidate, 'shelly-scan')).toMatchObject({
        ok: true,
        value: { id: sensor.id, runtimeAddress: sensor.runtimeAddress }
      });
    });
    expect(result.current.sensorDevices).toHaveLength(1);
    expect(result.current.sensorDevices[0]).not.toHaveProperty('temperatureC');
    expect(result.current.sensorSamplesById[sensor.runtimeAddress]?.at(-1)).toMatchObject(
      { temperatureC: 21.5 }
    );
  });

  it('returns persistence failures to the discovery caller instead of reporting success', () => {
    useSensorStore.setState({ loadError: { kind: 'storage-unavailable' } });
    const { result } = renderFlow();
    act(() => {
      expect(result.current.addDiscoveredSensor(candidate)).toEqual({
        ok: false,
        error: { kind: 'storage-unavailable' }
      });
    });
    expect(result.current.sensorDevices).toEqual([]);
    expect(result.current.loadError).toEqual({ kind: 'storage-unavailable' });
  });

  it('retains a referenced thermometer and its readings when deletion is blocked', () => {
    useSensorStore.setState({ items: [sensor] });
    useRuleStore.setState({ items: [climate] });
    const { result } = renderFlow();
    act(() => {
      result.current.addDiscoveredSensor(candidate);
    });
    act(() => {
      expect(result.current.removeSensorDevice(sensor.id)).toEqual({
        ok: false,
        error: { kind: 'device-referenced', ruleIds: [climate.id] }
      });
    });
    expect(result.current.sensorDevices).toHaveLength(1);
    expect(result.current.sensorSamplesById[sensor.runtimeAddress]).toHaveLength(1);
  });

  it('clears samples by runtime address after successful removal', () => {
    const { result } = renderFlow();
    act(() => {
      result.current.addDiscoveredSensor(candidate);
    });
    act(() => {
      expect(result.current.removeSensorDevice(sensor.id).ok).toBe(true);
    });
    expect(result.current.sensorDevices).toEqual([]);
    expect(result.current.sensorSamplesById[sensor.runtimeAddress]).toBeUndefined();
  });
});
