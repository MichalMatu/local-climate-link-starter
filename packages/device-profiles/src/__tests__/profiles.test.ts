import {
  outputProfileSchema,
  outputProfiles,
  sensorProfileSchema,
  sensorProfiles
} from '../index.js';

describe('device profiles', () => {
  it('validates sensor profiles with Zod', () => {
    for (const profile of sensorProfiles) {
      expect(sensorProfileSchema.parse(profile)).toEqual(profile);
    }
  });

  it('validates output profiles with Zod', () => {
    for (const profile of outputProfiles) {
      expect(outputProfileSchema.parse(profile)).toEqual(profile);
    }
  });
});
