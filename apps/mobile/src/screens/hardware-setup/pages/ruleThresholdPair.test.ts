import { describe, expect, it } from 'vitest';
import { correctedOffThresholdInput } from './ruleThresholdPair.js';

describe('correctedOffThresholdInput', () => {
  it('moves OFF one full unit above ON for below-direction rules when needed', () => {
    expect(
      correctedOffThresholdInput({
        direction: 'below',
        onThresholdInput: '60',
        offThresholdInput: '55'
      })
    ).toBe('61');
    expect(
      correctedOffThresholdInput({
        direction: 'below',
        onThresholdInput: '20',
        offThresholdInput: '20'
      })
    ).toBe('21');
  });

  it('moves OFF one full unit below ON for above-direction rules when needed', () => {
    expect(
      correctedOffThresholdInput({
        direction: 'above',
        onThresholdInput: '55',
        offThresholdInput: '60'
      })
    ).toBe('54');
    expect(
      correctedOffThresholdInput({
        direction: 'above',
        onThresholdInput: '20',
        offThresholdInput: '20'
      })
    ).toBe('19');
  });

  it('leaves any already valid manual gap unchanged, including gaps below one unit', () => {
    expect(
      correctedOffThresholdInput({
        direction: 'below',
        onThresholdInput: '20',
        offThresholdInput: '20.5'
      })
    ).toBeNull();
    expect(
      correctedOffThresholdInput({
        direction: 'above',
        onThresholdInput: '20',
        offThresholdInput: '19.5'
      })
    ).toBeNull();
  });

  it('does not guess while either input is empty or non-numeric', () => {
    expect(
      correctedOffThresholdInput({
        direction: 'below',
        onThresholdInput: '',
        offThresholdInput: '55'
      })
    ).toBeNull();
    expect(
      correctedOffThresholdInput({
        direction: 'above',
        onThresholdInput: '65',
        offThresholdInput: 'x'
      })
    ).toBeNull();
  });
});
