import { afterEach, describe, expect, it, vi } from 'vitest';
import { readShellyManagedAutomationScriptCode } from '../flows/hardware-setup/shellyRequests.js';

const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });

const installFetchMock = (scriptName = 'Local Climate Link Thermostat') => {
  const getCodeIds: number[] = [];
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      id?: number | string;
      method?: string;
      params?: { id?: number };
    };

    let result: unknown = {};
    if (body.method === 'Script.List') {
      result = {
        scripts: [
          { id: 3, name: 'Unrelated Script', enable: true, running: true },
          { id: 7, name: scriptName, enable: true, running: true }
        ]
      };
    } else if (body.method === 'Script.GetCode') {
      if (typeof body.params?.id === 'number') {
        getCodeIds.push(body.params.id);
      }
      result = { data: '// deployed exact source', left: 0 };
    }

    return jsonResponse({ id: body.id ?? 1, result });
  });

  vi.stubGlobal('fetch', fetchMock);
  return { getCodeIds };
};

describe('readShellyManagedAutomationScriptCode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads Script.GetCode only for the exact managed id', async () => {
    const { getCodeIds } = installFetchMock();

    await expect(
      readShellyManagedAutomationScriptCode('http://192.168.0.20/', 7)
    ).resolves.toBe('// deployed exact source');
    expect(getCodeIds).toEqual([7]);
  });

  it('does not read code when the stored id belongs to an unrelated script', async () => {
    const { getCodeIds } = installFetchMock('Other Controller');

    await expect(
      readShellyManagedAutomationScriptCode('http://192.168.0.20/', 7)
    ).rejects.toThrow('exact managed automation script');
    expect(getCodeIds).toEqual([]);
  });
});
