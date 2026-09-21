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
    if (!response) throw new Error('Missing fake response.');
    return response as Result<TResponse>;
  }
}

const fullConfig = {
  leds: {
    mode: 'switch',
    colors: {
      'switch:0': {
        on: { rgb: [0, 100, 0], brightness: 100 },
        off: { rgb: [100, 0, 0], brightness: 100 }
      },
      power: { brightness: 80 }
    },
    night_mode: {
      enable: true,
      brightness: 10,
      active_between: ['22:00', '06:00']
    }
  },
  controls: { 'switch:0': { in_mode: 'momentary' } }
};

describe('RpcShellyPlugsUiClient', () => {
  it('detects support, validates LEDs and controls, and exposes capabilities', async () => {
    const transport = new RecordingTransport([
      {
        ok: true,
        value: {
          methods: ['Shelly.GetStatus', 'PLUGS_UI.GetConfig', 'PLUGS_UI.SetConfig']
        }
      },
      { ok: true, value: fullConfig }
    ]);
    const client = new RpcShellyPlugsUiClient(transport);

    await expect(client.read()).resolves.toEqual({
      ok: true,
      value: {
        supported: true,
        config: fullConfig,
        capabilities: {
          switchColors: true,
          powerBrightness: true,
          nightMode: true
        },
        controlCapabilities: { buttonInputMode: true }
      }
    });
    expect(transport.requests).toEqual([
      { method: 'Shelly.ListMethods' },
      { method: 'PLUGS_UI.GetConfig' }
    ]);
  });

  it('accepts the real disabled night-mode shape with an empty active window', async () => {
    const transport = new RecordingTransport([
      {
        ok: true,
        value: { methods: ['PLUGS_UI.GetConfig', 'PLUGS_UI.SetConfig'] }
      },
      {
        ok: true,
        value: {
          leds: {
            mode: 'switch',
            night_mode: { enable: false, brightness: 100, active_between: [] }
          }
        }
      }
    ]);

    await expect(new RpcShellyPlugsUiClient(transport).read()).resolves.toEqual({
      ok: true,
      value: {
        supported: true,
        config: {
          leds: {
            mode: 'switch',
            night_mode: { enable: false, brightness: 100, active_between: [] }
          }
        },
        capabilities: { switchColors: false, powerBrightness: false, nightMode: true },
        controlCapabilities: { buttonInputMode: false }
      }
    });
  });

  it('derives capabilities from fields actually returned by the device', async () => {
    const transport = new RecordingTransport([
      {
        ok: true,
        value: { methods: ['PLUGS_UI.GetConfig', 'PLUGS_UI.SetConfig'] }
      },
      { ok: true, value: { leds: { mode: 'off' } } }
    ]);

    await expect(new RpcShellyPlugsUiClient(transport).read()).resolves.toEqual({
      ok: true,
      value: {
        supported: true,
        config: { leds: { mode: 'off' } },
        capabilities: {
          switchColors: false,
          powerBrightness: false,
          nightMode: false
        },
        controlCapabilities: { buttonInputMode: false }
      }
    });
  });

  it('returns a clean unsupported state without calling PLUGS_UI', async () => {
    const transport = new RecordingTransport([
      { ok: true, value: { methods: ['Shelly.GetStatus', 'Switch.Set'] } }
    ]);
    const client = new RpcShellyPlugsUiClient(transport);

    await expect(client.read()).resolves.toEqual({
      ok: true,
      value: { supported: false }
    });
    expect(transport.requests).toEqual([{ method: 'Shelly.ListMethods' }]);
  });

  it('writes only changed LED leaves and never writes controls', async () => {
    const transport = new RecordingTransport([
      { ok: true, value: { restart_required: false } }
    ]);
    const client = new RpcShellyPlugsUiClient(transport);

    await expect(
      client.setLeds({
        colors: { 'switch:0': { on: { brightness: 35 } } },
        night_mode: { brightness: 7, active_between: ['23:30', '05:45'] }
      })
    ).resolves.toEqual({ ok: true, value: { restart_required: false } });

    expect(transport.requests).toEqual([
      {
        method: 'PLUGS_UI.SetConfig',
        params: {
          config: {
            leds: {
              colors: { 'switch:0': { on: { brightness: 35 } } },
              night_mode: { brightness: 7, active_between: ['23:30', '05:45'] }
            }
          }
        }
      }
    ]);
    expect(JSON.stringify(transport.requests)).not.toContain('"controls"');
  });

  it('writes only the physical button input mode and never writes LEDs', async () => {
    const transport = new RecordingTransport([
      { ok: true, value: { restart_required: false } }
    ]);
    const client = new RpcShellyPlugsUiClient(transport);

    await expect(client.setButtonInputMode('detached')).resolves.toEqual({
      ok: true,
      value: { restart_required: false }
    });

    expect(transport.requests).toEqual([
      {
        method: 'PLUGS_UI.SetConfig',
        params: {
          config: {
            controls: {
              'switch:0': { in_mode: 'detached' }
            }
          }
        }
      }
    ]);
    expect(JSON.stringify(transport.requests)).not.toContain('"leds"');
  });

  it('keeps relay-state and off presets as narrow LED-only patches', async () => {
    const transport = new RecordingTransport([
      { ok: true, value: { restart_required: false } },
      { ok: true, value: { restart_required: false } }
    ]);
    const client = new RpcShellyPlugsUiClient(transport);

    await client.setLeds(createRelayStateLedPatch());
    await client.setLeds(createLedOffPatch());

    expect(transport.requests[0]).toMatchObject({
      method: 'PLUGS_UI.SetConfig',
      params: { config: { leds: { mode: 'switch' } } }
    });
    expect(transport.requests[1]).toEqual({
      method: 'PLUGS_UI.SetConfig',
      params: { config: { leds: { mode: 'off' } } }
    });
  });

  it('rejects invalid night-mode times before transport', async () => {
    const transport = new RecordingTransport([]);
    const result = await new RpcShellyPlugsUiClient(transport).setLeds({
      night_mode: { active_between: ['25:00', '06:00'] }
    });

    expect(result).toMatchObject({ ok: false, error: { kind: 'validation-failed' } });
    expect(transport.requests).toEqual([]);
  });

  it('rejects unsupported button input modes before transport', async () => {
    const transport = new RecordingTransport([]);
    const result = await new RpcShellyPlugsUiClient(transport).setButtonInputMode(
      'follow' as never
    );

    expect(result).toMatchObject({ ok: false, error: { kind: 'validation-failed' } });
    expect(transport.requests).toEqual([]);
  });
});
