import { describe, expect, it } from 'vitest';
import {
  createDefaultShellyThermostatConfig,
  generateShellyThermostatScript,
  shellyThermostatConfigSchema
} from '../index.js';

describe('climate rule schedule generation', () => {
  it('embeds normalized time windows into the owned climate script', () => {
    const config = createDefaultShellyThermostatConfig();
    config.schedule = {
      windows: [{ days: [5, 1, 3], start: '22:00', end: '02:00' }]
    };

    const script = generateShellyThermostatScript(config);

    expect(script).toContain('"tw":[[[1,3,5],1320,120]]');
    expect(script).toContain('function aw()');
    expect(script).toContain('W<0?"nt":"tw"');
    expect(script).not.toContain('Schedule.Create');
    expect(() => new Function(script)).not.toThrow();
  });

  it('keeps unrestricted climate rules free of runtime schedule code', () => {
    const script = generateShellyThermostatScript(createDefaultShellyThermostatConfig());
    expect(script).not.toContain('"tw":');
    expect(script).not.toContain('function aw()');
  });

  it('rejects empty, duplicate-day and zero-length schedule windows', () => {
    const base = createDefaultShellyThermostatConfig();
    expect(
      shellyThermostatConfigSchema.safeParse({ ...base, schedule: { windows: [] } })
        .success
    ).toBe(false);
    expect(
      shellyThermostatConfigSchema.safeParse({
        ...base,
        schedule: { windows: [{ days: [1, 1], start: '08:00', end: '09:00' }] }
      }).success
    ).toBe(false);
    expect(
      shellyThermostatConfigSchema.safeParse({
        ...base,
        schedule: { windows: [{ days: [1], start: '08:00', end: '08:00' }] }
      }).success
    ).toBe(false);
  });
});
