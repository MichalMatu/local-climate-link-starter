import { describe, expect, it } from 'vitest';
import { climate, plug, sensor, time } from '../../registry/fixtures.test-support.js';
import { buildSensorRuleUsageById } from './usage.js';

describe('thermometer rule usage', () => {
  it('derives Rule -> Plug relationships only from climate rules', () => {
    expect(
      buildSensorRuleUsageById(
        [sensor],
        [
          { ...climate, name: 'Grow temperature' },
          { ...time, id: 'rule-time-other', name: 'Lights schedule' }
        ],
        [{ ...plug, name: 'Heater plug' }]
      )
    ).toEqual({
      [sensor.id]: [
        {
          ruleId: climate.id,
          ruleName: 'Grow temperature',
          plugId: plug.id,
          plugName: 'Heater plug'
        }
      ]
    });
  });

  it('falls back to plug id when the referenced plug is missing', () => {
    expect(buildSensorRuleUsageById([sensor], [climate], [])[sensor.id]).toEqual([
      expect.objectContaining({ plugId: climate.plugId, plugName: climate.plugId })
    ]);
  });
});
