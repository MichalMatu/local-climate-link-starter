import { describe, expect, it } from 'vitest';
import { diagnosticSnapshotSchema } from '../hardware-setup/schemas.js';
import { installedAutomationHealth } from './runtimeDiagnostics.js';

const snapshot = (
  overrides: {
    lastSeenUptimeMs?: number | null;
    uptimeSec?: number | null;
    staleTimeoutSec?: number;
    dataState?: string;
  } = {}
) =>
  diagnosticSnapshotSchema.parse({
    v: 1,
    z: 'hash',
    s: ['AA:BB:CC:DD:EE:FF', 'Sensor'],
    q: [0, 0, 19, 20, overrides.staleTimeoutSec ?? 120, -85],
    y: [
      '12:00',
      1_782_000_000,
      'uptimeSec' in overrides ? (overrides.uptimeSec ?? null) : 1000
    ],
    p: [false, 0, 230, 0, 100, 30],
    g: [
      overrides.lastSeenUptimeMs === undefined ? 950_000 : overrides.lastSeenUptimeMs,
      21.5,
      55,
      88,
      -60,
      false,
      'ok',
      900_000,
      null,
      0,
      0,
      21.5,
      1.2,
      19,
      20,
      960_000,
      overrides.dataState ?? 'ok'
    ]
  });

describe('installedAutomationHealth', () => {
  it('marks a fresh runtime snapshot as healthy', () => {
    expect(installedAutomationHealth(snapshot())).toBe('ok');
  });

  it('marks data older than the configured stale timeout as stale', () => {
    expect(
      installedAutomationHealth(
        snapshot({ lastSeenUptimeMs: 700_000, staleTimeoutSec: 120 })
      )
    ).toBe('stale');
  });

  it('respects an explicit stale runtime state', () => {
    expect(installedAutomationHealth(snapshot({ dataState: 'st' }))).toBe('stale');
  });

  it('keeps health neutral when uptime data is unavailable', () => {
    expect(installedAutomationHealth(snapshot({ uptimeSec: null }))).toBe('unknown');
  });
});
