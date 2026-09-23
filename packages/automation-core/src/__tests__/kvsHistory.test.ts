import { describe, expect, it } from 'vitest';
import {
  LCL_HISTORY_DEFAULT_FLUSH_INTERVAL_SEC,
  LCL_HISTORY_DEFAULT_SAMPLE_INTERVAL_SEC,
  LCL_HISTORY_DEFAULT_SLOT_COUNT,
  LCL_HISTORY_FORMAT_VERSION,
  LCL_HISTORY_KVS_META_KEY,
  appendLclHistorySample,
  createLclHistorySegment,
  decodeLclHistoryKvsItems,
  decodeLclHistoryMeta,
  decodeLclHistorySegment,
  encodeLclHistoryMeta,
  encodeLclHistorySegment,
  lclHistorySegmentKey,
  type LclHistorySample
} from '../history/kvsHistory.js';

const sample = (index: number): LclHistorySample => ({
  clock: 'unix',
  timeSec: 1_800_000_000 + index * 900,
  temperatureC: (234 + index) / 10,
  humidityPct: (551 - index) / 10,
  vpdKpa: (112 + index) / 100,
  freshSensorCount: 1,
  relayOn: index % 2 === 1,
  reason: index % 2 === 1 ? 'ab' : 'ib'
});

describe('Shelly KVS history codec', () => {
  it('round-trips compact metadata', () => {
    const encoded = encodeLclHistoryMeta({
      version: LCL_HISTORY_FORMAT_VERSION,
      slots: LCL_HISTORY_DEFAULT_SLOT_COUNT,
      nextSlot: 7,
      nextSequence: 39,
      sampleIntervalSec: LCL_HISTORY_DEFAULT_SAMPLE_INTERVAL_SEC,
      flushIntervalSec: LCL_HISTORY_DEFAULT_FLUSH_INTERVAL_SEC
    });
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(encoded.value.length).toBeLessThan(253);
    expect(decodeLclHistoryMeta(encoded.value)).toEqual({
      ok: true,
      value: {
        version: 1,
        slots: 32,
        nextSlot: 7,
        nextSequence: 39,
        sampleIntervalSec: 900,
        flushIntervalSec: 7200
      }
    });
  });

  it('packs eight representative 15-minute samples into one KVS value', () => {
    let segmentResult = createLclHistorySegment(12, sample(0));
    expect(segmentResult.ok).toBe(true);
    if (!segmentResult.ok) return;
    for (let index = 1; index < 8; index += 1) {
      segmentResult = appendLclHistorySample(segmentResult.value, sample(index));
      expect(segmentResult.ok).toBe(true);
      if (!segmentResult.ok) return;
    }
    const encoded = encodeLclHistorySegment(segmentResult.value);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(encoded.value.length).toBeLessThanOrEqual(253);
    expect(decodeLclHistorySegment(encoded.value)).toEqual({
      ok: true,
      value: segmentResult.value
    });
  });

  it('refuses an append that would exceed the KVS value limit', () => {
    const verboseSample = (index: number): LclHistorySample => ({
      ...sample(index),
      reason: 'abcdefghijklmnop'
    });
    let segmentResult = createLclHistorySegment(1, verboseSample(0));
    expect(segmentResult.ok).toBe(true);
    if (!segmentResult.ok) return;
    let rejected = false;
    for (let index = 1; index < 20; index += 1) {
      const next = appendLclHistorySample(segmentResult.value, verboseSample(index));
      if (!next.ok) {
        expect(next.error.code).toBe('value-too-long');
        rejected = true;
        break;
      }
      segmentResult = next;
    }
    expect(rejected).toBe(true);
  });

  it('reconstructs ordered history from ring slots and reports corrupted entries', () => {
    const first = createLclHistorySegment(10, sample(0));
    const second = createLclHistorySegment(11, sample(1));
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    const firstEncoded = encodeLclHistorySegment(first.value);
    const secondEncoded = encodeLclHistorySegment(second.value);
    const metaEncoded = encodeLclHistoryMeta({
      version: 1,
      slots: 32,
      nextSlot: 2,
      nextSequence: 12,
      sampleIntervalSec: 900,
      flushIntervalSec: 7200
    });
    expect(firstEncoded.ok && secondEncoded.ok && metaEncoded.ok).toBe(true);
    if (!firstEncoded.ok || !secondEncoded.ok || !metaEncoded.ok) return;

    const decoded = decodeLclHistoryKvsItems([
      { key: lclHistorySegmentKey(1), value: secondEncoded.value },
      { key: LCL_HISTORY_KVS_META_KEY, value: metaEncoded.value },
      { key: lclHistorySegmentKey(0), value: firstEncoded.value },
      { key: lclHistorySegmentKey(2), value: '{bad-json' },
      { key: 'unrelated', value: 'ignored' }
    ]);

    expect(decoded.segments.map(({ segment }) => segment.sequence)).toEqual([10, 11]);
    expect(decoded.samples.map(({ timeSec }) => timeSec)).toEqual([
      sample(0).timeSec,
      sample(1).timeSec
    ]);
    expect(decoded.invalidKeys).toEqual([lclHistorySegmentKey(2)]);
    expect(decoded.meta?.nextSequence).toBe(12);
  });

  it('rejects clock changes and time regressions inside a segment', () => {
    const initial = createLclHistorySegment(0, sample(0));
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    expect(
      appendLclHistorySample(initial.value, { ...sample(1), clock: 'uptime', timeSec: 10 })
    ).toMatchObject({ ok: false, error: { code: 'clock-mismatch' } });
    expect(
      appendLclHistorySample(initial.value, { ...sample(1), timeSec: sample(0).timeSec - 1 })
    ).toMatchObject({ ok: false, error: { code: 'time-regression' } });
  });
});
