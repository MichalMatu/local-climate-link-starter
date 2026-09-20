import { describe, expect, it } from 'vitest';
import { normalizeShellyDeviceId } from '../deviceIdentity.js';

describe('normalizeShellyDeviceId', () => {
  it('normalizes stable Shelly identity independently of endpoint formatting', () => {
    expect(normalizeShellyDeviceId('  SHELLYPLUGSG3-A1B2C3  ')).toBe(
      'shellyplugsg3-a1b2c3'
    );
  });
});
