import { describe, expect, it } from 'vitest';
import { installationRecoveryState } from './healthRecovery.js';

const healthyInput = {
  diagnosticsError: false,
  controlError: false,
  scriptMatch: 'matched' as const,
  automationMode: 'auto' as const,
  runtimeHealth: 'ok' as const
};

describe('installationRecoveryState', () => {
  it('classifies a fully unreachable Shelly as offline with a read-only refresh action', () => {
    expect(
      installationRecoveryState({
        ...healthyInput,
        diagnosticsError: true,
        controlError: true
      })
    ).toEqual({ issue: 'offline', action: 'refresh' });
  });

  it('classifies a stopped owned script as safely resumable', () => {
    expect(
      installationRecoveryState({
        ...healthyInput,
        automationMode: 'stopped'
      })
    ).toEqual({ issue: 'script-stopped', action: 'resume' });
  });

  it('keeps intentional MANUAL mode out of recovery', () => {
    expect(
      installationRecoveryState({
        ...healthyInput,
        automationMode: 'manual'
      })
    ).toBeNull();
  });

  it('maps stale runtime data to missing fresh sensor data without changing configuration', () => {
    expect(
      installationRecoveryState({
        ...healthyInput,
        runtimeHealth: 'stale'
      })
    ).toEqual({ issue: 'sensor-missing', action: 'refresh' });
  });

  it('does not take over a missing or mismatched script owner', () => {
    expect(
      installationRecoveryState({
        ...healthyInput,
        scriptMatch: 'mismatch'
      })
    ).toEqual({ issue: 'ownership-problem', action: 'refresh' });

    expect(
      installationRecoveryState({
        ...healthyInput,
        scriptMatch: 'missing',
        automationMode: 'missing'
      })
    ).toEqual({ issue: 'ownership-problem', action: 'refresh' });
  });

  it('returns no recovery issue for a healthy installation', () => {
    expect(installationRecoveryState(healthyInput)).toBeNull();
  });
});
