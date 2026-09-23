import { describe, expect, it } from 'vitest';
import {
  LCL_HISTORY_FORMAT_VERSION,
  LCL_HISTORY_KVS_META_KEY,
  appendLclHistorySample,
  createLclHistorySegment,
  decodeLclHistoryKvsItems,
  decodeLclHistoryMeta,
  decodeLclHistorySegment,
  encodeLclHistoryMeta,
  encodeLclHistorySegment,
  lclHistorySampleChangedEnough,
  lclHistorySegmentKey,
  type LclHistorySample
} from '../history/kvsHistory.js';

const sample = (temperatureC: number, humidityPct: number, relayOn = false): LclHistorySample => ({
  temperatureC,
  humidityPct,
  relayOn
});

describe('Shelly KVS rolling history tail', () => {
  it('round-trips minimal metadata', () => {
    const encoded = encodeLclHistoryMeta({
      version: LCL_HISTORY_FORMAT_VERSION,
      slots: 32,
      nextSlot: 7,
      validSlots: 12
    });
    expect(encoded).toEqual({ ok: true, value: '[1,32,7,12]' });
    if (!encoded.ok) return;
    expect(decodeLclHistoryMeta(encoded.value)).toEqual({
      ok: true,
      value: { version: 1, slots: 32, nextSlot: 7, validSlots: 12 }
    });
  });

  it('stores only temperature, humidity and relay state', () => {
    const segment = createLclHistorySegment(sample(23.4, 55.1));
    expect(segment.ok).toBe(true);
    if (!segment.ok) return;
    const encoded = encodeLclHistorySegment(segment.value);
    expect(encoded).toEqual({ ok: true, value: '[1,[[234,551,0]]]' });
    if (!encoded.ok) return;
    expect(decodeLclHistorySegment(encoded.value)).toEqual({ ok: true, value: segment.value });
  });

  it('packs many compact samples before reaching the 253-character KVS limit', () => {
    let segment = createLclHistorySegment(sample(23.4, 55.1));
    expect(segment.ok).toBe(true);
    if (!segment.ok) return;

    let accepted = 1;
    for (let index = 1; index < 50; index += 1) {
      const next = appendLclHistorySample(
        segment.value,
        sample((234 + index) / 10, (551 - (index % 20)) / 10, index % 2 === 1)
      );
      if (!next.ok) {
        expect(next.error.code).toBe('value-too-long');
        break;
      }
      segment = next;
      accepted += 1;
    }

    expect(accepted).toBeGreaterThanOrEqual(16);
    const encoded = encodeLclHistorySegment(segment.value);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(encoded.value.length).toBeLessThanOrEqual(253);
  });

  it('orders wrapped slots using only nextSlot and validSlots', () => {
    const encodedSegment = (temperatureC: number) => {
      const created = createLclHistorySegment(sample(temperatureC, 50));
      if (!created.ok) throw new Error('fixture');
      const encoded = encodeLclHistorySegment(created.value);
      if (!encoded.ok) throw new Error('fixture');
      return encoded.value;
    };
    const meta = encodeLclHistoryMeta({ version: 1, slots: 4, nextSlot: 1, validSlots: 4 });
    expect(meta.ok).toBe(true);
    if (!meta.ok) return;

    const decoded = decodeLclHistoryKvsItems([
      { key: LCL_HISTORY_KVS_META_KEY, value: meta.value },
      { key: lclHistorySegmentKey(0), value: encodedSegment(24) },
      { key: lclHistorySegmentKey(1), value: encodedSegment(21) },
      { key: lclHistorySegmentKey(2), value: encodedSegment(22) },
      { key: lclHistorySegmentKey(3), value: encodedSegment(23) }
    ]);

    expect(decoded.segments.map(({ slot }) => slot)).toEqual([1, 2, 3, 0]);
    expect(decoded.samples.map(({ temperatureC }) => temperatureC)).toEqual([21, 22, 23, 24]);
  });

  it('records meaningful changes but ignores sensor noise', () => {
    const previous = sample(23, 55, false);
    expect(lclHistorySampleChangedEnough(previous, sample(23.2, 55.9, false))).toBe(false);
    expect(lclHistorySampleChangedEnough(previous, sample(23.3, 55, false))).toBe(true);
    expect(lclHistorySampleChangedEnough(previous, sample(23, 56, false))).toBe(true);
    expect(lclHistorySampleChangedEnough(previous, sample(23, 55, true))).toBe(true);
    expect(lclHistorySampleChangedEnough(null, previous)).toBe(true);
  });

  it('reports corrupt tail entries without failing the remaining tail', () => {
    const good = createLclHistorySegment(sample(23, 50));
    expect(good.ok).toBe(true);
    if (!good.ok) return;
    const goodEncoded = encodeLclHistorySegment(good.value);
    expect(goodEncoded.ok).toBe(true);
    if (!goodEncoded.ok) return;

    const decoded = decodeLclHistoryKvsItems([
      { key: lclHistorySegmentKey(0), value: goodEncoded.value },
      { key: lclHistorySegmentKey(1), value: '{bad-json' }
    ]);

    expect(decoded.samples).toEqual([sample(23, 50)]);
    expect(decoded.invalidKeys).toEqual([lclHistorySegmentKey(1)]);
  });
});
