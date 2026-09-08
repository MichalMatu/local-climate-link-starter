import { describe, expect, it } from 'vitest';
import {
  createLedOffPatch,
  createRelayStateLedPatch,
  RpcShellyPlugsUiClient,
  type Result,
  type ShellyRpcRequest,
  type ShellyRpcTransport
} from '../index.js';

class RecordingTransport implements ShellyRpcTransport {
  readonly requests: ShellyRpcRequest[] = [];

  constructor(private readonly responses: Result<unknown>[]) {}

  async call<TResponse>(request: ShellyRpcRequest): Promise<Result<TResponse>> {
    this.requests.push(request);
    const response = this.responses.shift();
    if (!response) {
      throw new Error('Missing fake response.');
    }
    return response as Result<TResponse>;
  }
}

describe('RpcShellyPlugsUiClient', () => {
  it('detects support and validates current LED configuration', async () => {
    const transport = new RecordingTransport([
      {
        ok: true,
        value: {
          methods: [
            'Shelly.GetStatus',
            'PLUGS_UI.GetConfig',
            'PLUGS_UI.SetConfig'
          ]
        }
      },
      {
        ok: true,
        value: {
          leds: {
            mode: 'switch',
            colors: {
              'switch:0': {
                on: { rgb: [0, 100, 0], brightness: 100 },
                off: { rgb: [100, 0, 0], brightness: 100 }
              },
              power: { brightness: 80 }
            }
          },
          controls: { 'switch:0': { in_mode: 'momentary' } }
        }
      }
    ]);
    const client = new RpcShellyPlugsUiClient(transport);

    await expect(client.read()).resolves.toEqual({
      ok: true,
      value: {
        supported: true,
        config: {
          leds: {
            mode: 'switch',
            colors: {
              'switch:0': {
                on: { rgb: [0, 100, 0], brightness: 100 },
                off: { rgb: [100, 0, 0], brightness: 100 }
              },
              power: { brightness: 80 }
            }
          }
        }
      }
    });
    expect(transport.requests).toEqual([
      { method: 'Shelly.ListMethods' },
      { method: 'PLUGS_UI.GetConfig' }
    ]);
  });

  it('returns a clean unsupported state without calling PLUGS_UI', async () => {
    const transport = new RecordingTransport([
      {
        ok: true,
        value: { methods: ['Shelly.GetStatus', 'Switch.Set'] }
      }
    ]);
    const client = new RpcShellyPlugsUiClient(transport);

    await expect(client.read()).resolves.toEqual({
      ok: true,
      value: { supported: false }
    });
    expect(transport.requests).toEqual([{ method: 'Shelly.ListMethods' }]);
  });

  it('writes only the LED subtree for relay-state and off presets', async () => {
    const transport = new RecordingTransport([
      { ok: true, value: { restart_required: false } },
      { ok: true, value: { restart_required: false } }
    ]);
    const client = new RpcShellyPlugsUiClient(transport);

    await expect(client.setLeds(createRelayStateLedPatch())).resolves.toEqual({
      ok: true,
      value: { restart_required: false }
    });
    await expect(client.setLeds(createLedOffPatch())).resolves.toEqual({
      ok: true,
      value: { restart_required: false }
    });

    expect(transport.requests).toEqual([
      {
        method: 'PLUGS_UI.SetConfig',
        params: {
          config: {
            leds: {
              mode: 'switch',
              colors: {
                'switch:0': {
                  on: { rgb: [0, 100, 0], brightness: 100 },
                  off: { rgb: [100, 0, 0], brightness: 100 }
                }
              }
            }
          }
        }
      },
      {
        method: 'PLUGS_UI.SetConfig',
        params: { config: { leds: { mode: 'off' } } }
      }
    ]);
    expect(JSON.stringify(transport.requests)).not.toContain('"controls"');
  });
});
