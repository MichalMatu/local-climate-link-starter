import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ShellyRequestsModule from './shellyRequests.js';

const mocks = vi.hoisted(() => ({ call: vi.fn() }));

vi.mock('./shellyRequests.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ShellyRequestsModule>();
  return {
    ...actual,
    createShellyTransport: vi.fn(() => ({ call: mocks.call }))
  };
});

import { readShellyResourceDiagnostics } from './resourceDiagnostics.js';

describe('Shelly resource diagnostics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads exact script resources and whole-device RAM directly over RPC', async () => {
    mocks.call.mockImplementation(({ method }: { method: string }) =>
      Promise.resolve(
        method === 'Script.GetStatus'
          ? {
              ok: true,
              value: {
                running: true,
                mem_used: 12_288,
                mem_peak: 16_384,
                mem_free: 25_116,
                cpu: 0.3
              }
            }
          : {
              ok: true,
              value: { ram_size: 259_128, ram_free: 96_180 }
            }
      )
    );

    await expect(
      readShellyResourceDiagnostics('http://192.168.0.20/', 7)
    ).resolves.toEqual({
      script: {
        running: true,
        memUsedBytes: 12_288,
        memPeakBytes: 16_384,
        memFreeBytes: 25_116,
        cpuPercent: 0.3
      },
      system: { ramSizeBytes: 259_128, ramFreeBytes: 96_180 }
    });

    expect(mocks.call).toHaveBeenCalledWith({
      method: 'Script.GetStatus',
      params: { id: 7 }
    });
    expect(mocks.call).toHaveBeenCalledWith({ method: 'Sys.GetStatus' });
  });

  it('keeps firmware-dependent script fields optional', async () => {
    mocks.call
      .mockResolvedValueOnce({
        ok: true,
        value: { running: false, mem_free: 25_116, cpu: 0 }
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { ram_size: 259_128, ram_free: 96_180 }
      });

    const result = await readShellyResourceDiagnostics('http://192.168.0.20/', 1);

    expect(result.script).toEqual({
      running: false,
      memUsedBytes: null,
      memPeakBytes: null,
      memFreeBytes: 25_116,
      cpuPercent: 0
    });
  });

  it('preserves available device RAM when Script.GetStatus is unavailable', async () => {
    mocks.call
      .mockResolvedValueOnce({
        ok: false,
        error: { kind: 'rpc-error', userMessageKey: 'errors.shellyInvalidResponse' }
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { ram_size: 259_128, ram_free: 96_180 }
      });

    await expect(
      readShellyResourceDiagnostics('http://192.168.0.20/', 1)
    ).resolves.toEqual({
      script: null,
      system: { ramSizeBytes: 259_128, ramFreeBytes: 96_180 }
    });
  });
});
