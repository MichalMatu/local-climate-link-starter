import type {
  RelayTestResult,
  Result,
  ShellyClient,
  ShellyDeviceInfo,
  ShellyInstallPlan,
  ShellyInstallResult,
  ShellyStatus
} from '../model.js';
import { hashScriptCode } from './hash.js';

export interface FakeShellyClientOptions {
  matterEnabled?: boolean;
  failOnCommand?: boolean;
  sleepMs?: (durationMs: number) => Promise<void>;
}

const defaultSleep = (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

export class FakeShellyClient implements ShellyClient {
  private relayOn = false;
  private scriptUploaded = false;
  private readonly sleepMs: (durationMs: number) => Promise<void>;

  constructor(private readonly options: FakeShellyClientOptions = {}) {
    this.sleepMs = options.sleepMs ?? defaultSleep;
  }

  async getDeviceInfo(): Promise<Result<ShellyDeviceInfo>> {
    return {
      ok: true,
      value: {
        model: 'Shelly Plug S Gen3',
        gen: 3,
        firmwareId: 'demo'
      }
    };
  }

  async getStatus(): Promise<Result<ShellyStatus>> {
    return {
      ok: true,
      value: {
        matterEnabled: this.options.matterEnabled ?? false,
        scripts: this.options.matterEnabled ? 'disabled' : 'enabled',
        bluetooth: 'enabled',
        relayOn: this.relayOn,
        telemetry: {
          powerW: this.relayOn ? 28.4 : 0,
          voltageV: 230.1,
          currentA: this.relayOn ? 0.12 : 0,
          energyWh: 42.8,
          deviceTemperatureC: 31.2,
          wifiRssiDbm: -54
        },
        clock: {
          localTime: '12:00',
          unixTimeSec: 1_782_800_000,
          uptimeSec: 3600,
          timeSynced: true
        }
      }
    };
  }

  async installScript(plan: ShellyInstallPlan): Promise<Result<ShellyInstallResult>> {
    if (this.options.matterEnabled) {
      return {
        ok: false,
        error: {
          kind: 'matter-enabled',
          userMessageKey: 'errors.matterEnabled',
          technicalMessage: 'Matter is enabled in the fake Shelly state.',
          retryable: false
        }
      };
    }

    this.scriptUploaded = true;
    return {
      ok: true,
      value: {
        scriptId: 1,
        running: true,
        memUsed: 18_000,
        memFree: 92_000,
        scriptHash: hashScriptCode(`${plan.scriptName}:${plan.code}`)
      }
    };
  }

  async stopScript(): Promise<Result<null>> {
    this.scriptUploaded = false;
    return { ok: true, value: null };
  }

  async startScript(): Promise<Result<null>> {
    this.scriptUploaded = true;
    return { ok: true, value: null };
  }

  async deleteScript(): Promise<Result<null>> {
    this.scriptUploaded = false;
    return { ok: true, value: null };
  }

  async setRelayOn(): Promise<Result<null>> {
    this.relayOn = true;
    return { ok: true, value: null };
  }

  async setRelayOff(): Promise<Result<null>> {
    this.relayOn = false;
    return { ok: true, value: null };
  }

  async safeRelayTest(options?: {
    onDurationMs?: number;
  }): Promise<Result<RelayTestResult>> {
    let onCommandSent = false;
    let offCommandSent = false;

    try {
      if (this.options.failOnCommand) {
        return {
          ok: false,
          error: {
            kind: 'relay-test-failed',
            userMessageKey: 'errors.relayTestFailed',
            technicalMessage: 'Fake Shelly failed before relay ON command.',
            retryable: true
          }
        };
      }

      this.relayOn = true;
      onCommandSent = true;
      await this.sleepMs(options?.onDurationMs ?? 100);
    } finally {
      this.relayOn = false;
      offCommandSent = true;
    }

    return {
      ok: true,
      value: {
        finalRelayOn: this.relayOn,
        onCommandSent,
        offCommandSent
      }
    };
  }

  wasScriptUploaded(): boolean {
    return this.scriptUploaded;
  }
}
