import { describe, expect, it } from 'vitest';
import { createSparklinePath, resolveSparklineDomain } from './sparklinePath.js';

const yCoordinatesFromPath = (path: string): number[] =>
  [...path.matchAll(/[ML] \d+\.\d+ (\d+\.\d+)/g)].map((match) => Number(match[1]));

describe('sparklinePath', () => {
  it('keeps tiny temperature changes visually calm with a minimum value range', () => {
    const autoScaledPath = createSparklinePath([25.4, 25.8]);
    const stablePath = createSparklinePath([25.4, 25.8], { minimumRange: 5 });
    const autoY = yCoordinatesFromPath(autoScaledPath);
    const stableY = yCoordinatesFromPath(stablePath);

    const autoDelta = Math.abs(autoY[0]! - autoY[1]!);
    const stableDelta = Math.abs(stableY[0]! - stableY[1]!);

    expect(autoDelta).toBeGreaterThan(8);
    expect(stableDelta).toBeLessThan(3);
    expect(stableDelta).toBeLessThan(autoDelta / 3);
  });

  it('keeps humidity domain inside physical percentage bounds', () => {
    expect(
      resolveSparklineDomain([95], { minimumRange: 20, lowerBound: 0, upperBound: 100 })
    ).toEqual({
      min: 80,
      max: 100
    });
    expect(
      resolveSparklineDomain([5], { minimumRange: 20, lowerBound: 0, upperBound: 100 })
    ).toEqual({
      min: 0,
      max: 20
    });
  });

  it('draws a single reading as a horizontal line at its resolved value', () => {
    expect(
      createSparklinePath([50], { minimumRange: 20, lowerBound: 0, upperBound: 100 })
    ).toBe('M 1.00 14.00 L 99.00 14.00');
  });
});
