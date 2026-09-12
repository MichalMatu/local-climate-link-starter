import { describe, expect, it } from 'vitest';
import { buildUnsavedShellyScanUrls } from './useShellySetupScanFlow.js';

const device = (id: string, baseUrl: string) => ({
  id,
  name: id,
  baseUrl,
  scriptIdInput: '1'
});

describe('Shelly setup scan derivation', () => {
  it('excludes already saved devices from the requested IPv4 range', () => {
    expect(
      buildUnsavedShellyScanUrls(
        [device('saved', '192.168.0.2')],
        '192.168.0.1',
        '192.168.0.3'
      )
    ).toEqual(['http://192.168.0.1/', 'http://192.168.0.3/']);
  });

  it('preserves the full range when saved entries are outside it', () => {
    expect(
      buildUnsavedShellyScanUrls(
        [device('other', 'http://192.168.1.2/')],
        '192.168.0.1',
        '192.168.0.2'
      )
    ).toEqual(['http://192.168.0.1/', 'http://192.168.0.2/']);
  });
});
