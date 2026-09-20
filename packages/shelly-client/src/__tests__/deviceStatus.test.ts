import { describe, expect, it } from 'vitest';
import {
  parseShellyDeviceInfoResponse,
  parseShellyStatusResponse
} from '../rpc/deviceStatus.js';

describe('Shelly device/status response parsing', () => {
  it('normalizes components, plug telemetry and clock data', () => {
    expect(
      parseShellyStatusResponse({
        matter: { enable: true },
        script: { enable: true },
        ble: false,
        'switch:0': {
          output: true,
          apower: 12.5,
          voltage: 229.8,
          current: 0.06,
          aenergy: { total: 1234 },
          temperature: { tC: 41.2 }
        },
        wifi: { rssi: -52 },
        sys: {
          time: '17:40',
          unixtime: 1_700_000_000,
          uptime: 50,
          last_sync_ts: 1_699_999_000
        }
      })
    ).toEqual({
      ok: true,
      value: {
        matterEnabled: true,
        scripts: 'enabled',
        bluetooth: 'disabled',
        relayOn: true,
        telemetry: {
          powerW: 12.5,
          voltageV: 229.8,
          currentA: 0.06,
          energyWh: 1234,
          deviceTemperatureC: 41.2,
          wifiRssiDbm: -52
        },
        clock: {
          localTime: '17:40',
          unixTimeSec: 1_700_000_000,
          uptimeSec: 50,
          lastSyncUnixTimeSec: 1_699_999_000,
          timeSynced: true
        }
      }
    });
  });

  it('keeps missing components conservative', () => {
    expect(parseShellyStatusResponse({})).toEqual({
      ok: true,
      value: {
        matterEnabled: false,
        scripts: 'missing',
        bluetooth: 'missing',
        relayOn: false,
        telemetry: {},
        clock: { timeSynced: false }
      }
    });
  });

  it('rejects malformed device info', () => {
    expect(parseShellyDeviceInfoResponse({ model: 42, gen: '3' })).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', retryable: false }
    });
  });
});
