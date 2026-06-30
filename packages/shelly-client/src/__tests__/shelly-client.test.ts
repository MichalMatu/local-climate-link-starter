import {
  LOCAL_CLIMATE_LINK_BLE_DISCOVERY_SCRIPT_NAME,
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  FakeShellyClient,
  FetchShellyRpcTransport,
  RPC_METHODS,
  RpcShellyClient,
  createBleDiscoveryInstallPlan,
  createInstallPlan,
  withTimeout,
  type ShellyClientError,
  type ShellyRpcRequest,
  type ShellyRpcTransport
} from '../index.js';

const encoder = new TextEncoder();

interface RecordedScript {
  id: number;
  name: string;
  enable: boolean;
  running: boolean;
  code: string;
}

interface RecordingTransportOptions {
  scripts?: RecordedScript[];
  matterEnabled?: boolean;
  scriptComponent?: unknown;
  bleComponent?: unknown;
  failScriptList?: boolean;
  failOnCommand?: boolean;
  failOffCommand?: boolean;
  scriptRunning?: boolean;
  scriptStatusErrors?: unknown[];
  switchStatus?: Record<string, unknown>;
  wifiStatus?: Record<string, unknown>;
  sysStatus?: Record<string, unknown>;
}

const jsonResponse = (
  body: unknown,
  options: { ok?: boolean; status?: number; statusText?: string } = {}
): Response =>
  ({
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.statusText ?? 'OK',
    text: async () => JSON.stringify(body),
    json: async () => body
  }) as Response;

const sliceByUtf8ByteOffset = (
  value: string,
  offset: number,
  maxBytes: number
): { data: string; left: number } => {
  let skippedBytes = 0;
  let dataBytes = 0;
  let data = '';

  for (const character of value) {
    const characterBytes = encoder.encode(character).length;
    if (skippedBytes + characterBytes <= offset) {
      skippedBytes += characterBytes;
      continue;
    }
    if (dataBytes + characterBytes > maxBytes) {
      break;
    }
    data += character;
    dataBytes += characterBytes;
  }

  return {
    data,
    left: Math.max(encoder.encode(value).length - offset - dataBytes, 0)
  };
};

class RecordingTransport implements ShellyRpcTransport {
  readonly requests: ShellyRpcRequest[] = [];
  relayOn = false;

  constructor(private readonly options: RecordingTransportOptions = {}) {}

  async call<TResponse>(
    request: ShellyRpcRequest
  ): Promise<{ ok: true; value: TResponse } | { ok: false; error: ShellyClientError }> {
    this.requests.push(request);

    if (request.method === RPC_METHODS.ShellyGetDeviceInfo) {
      return {
        ok: true,
        value: {
          model: 'S3PL-00112EU',
          gen: 3,
          matter: this.options.matterEnabled ?? false
        } as TResponse
      };
    }
    if (request.method === RPC_METHODS.ShellyGetStatus) {
      return {
        ok: true,
        value: {
          'switch:0': { output: this.relayOn, ...this.options.switchStatus },
          wifi: this.options.wifiStatus,
          sys: this.options.sysStatus,
          matter: this.options.matterEnabled ?? false,
          ...(this.options.scriptComponent === undefined
            ? { script: true }
            : this.options.scriptComponent === null
              ? {}
              : { script: this.options.scriptComponent }),
          ...(this.options.bleComponent === undefined
            ? { ble: true }
            : this.options.bleComponent === null
              ? {}
              : { ble: this.options.bleComponent })
        } as TResponse
      };
    }
    if (request.method === RPC_METHODS.ScriptList) {
      if (this.options.failScriptList) {
        return {
          ok: false,
          error: {
            kind: 'script-upload-failed',
            userMessageKey: 'errors.scriptUploadFailed',
            technicalMessage: 'Script.List is unavailable.',
            retryable: false
          }
        };
      }
      return {
        ok: true,
        value: {
          scripts: (this.options.scripts ?? []).map((script) => ({
            id: script.id,
            name: script.name,
            enable: script.enable,
            running: script.running
          }))
        } as TResponse
      };
    }
    if (request.method === RPC_METHODS.ScriptCreate) {
      return { ok: true, value: { id: 4 } as TResponse };
    }
    if (request.method === RPC_METHODS.ScriptGetCode) {
      const params = request.params as { id: number; offset?: number; len?: number };
      const script = this.options.scripts?.find((entry) => entry.id === params.id);
      const offset = params.offset ?? 0;
      const len = params.len ?? 1024;
      const { data, left } =
        script === undefined
          ? { data: '', left: 0 }
          : sliceByUtf8ByteOffset(script.code, offset, len);
      return { ok: true, value: { data, left } as TResponse };
    }
    if (request.method === RPC_METHODS.ScriptGetStatus) {
      return {
        ok: true,
        value: {
          id: 4,
          running: this.options.scriptRunning ?? true,
          mem_used: 12,
          mem_free: 34,
          errors: this.options.scriptStatusErrors
        } as TResponse
      };
    }
    if (request.method === RPC_METHODS.SwitchSet) {
      const params = request.params as { on: boolean };
      if (params.on && this.options.failOnCommand) {
        return {
          ok: false,
          error: {
            kind: 'relay-test-failed',
            userMessageKey: 'errors.relayTestFailed',
            technicalMessage: 'ON command failed.',
            retryable: true
          }
        };
      }
      if (!params.on && this.options.failOffCommand) {
        return {
          ok: false,
          error: {
            kind: 'relay-test-failed',
            userMessageKey: 'errors.relayTestFailed',
            technicalMessage: 'OFF command failed.',
            retryable: true
          }
        };
      }
      this.relayOn = params.on;
      return { ok: true, value: null as TResponse };
    }
    if (request.method === RPC_METHODS.SwitchGetStatus) {
      return { ok: true, value: { id: 0, output: this.relayOn } as TResponse };
    }

    return { ok: true, value: {} as TResponse };
  }
}

describe('RpcShellyClient', () => {
  it('sends the expected RPC request shape during script install', async () => {
    const transport = new RecordingTransport();
    const client = new RpcShellyClient(transport);
    const result = await client.installScript(createInstallPlan('print("safe off");'));

    expect(result.ok).toBe(true);
    expect(transport.requests.map((request) => request.method)).toEqual([
      RPC_METHODS.ShellyGetDeviceInfo,
      RPC_METHODS.ShellyGetStatus,
      RPC_METHODS.ScriptList,
      RPC_METHODS.ScriptCreate,
      RPC_METHODS.ScriptPutCode,
      RPC_METHODS.ScriptSetConfig,
      RPC_METHODS.ScriptStart,
      RPC_METHODS.ScriptGetStatus
    ]);
    const putCode = transport.requests.find(
      (request) => request.method === RPC_METHODS.ScriptPutCode
    );
    expect(putCode?.params).toMatchObject({ id: 4, append: false });
  });

  it('throttles successful mutating script RPC calls during install', async () => {
    const transport = new RecordingTransport();
    const sleepMs = vi.fn<(_durationMs: number) => Promise<void>>(() =>
      Promise.resolve()
    );
    const client = new RpcShellyClient(transport, {
      mutationDelayMs: 100,
      sleepMs
    });
    const result = await client.installScript(createInstallPlan('print("safe off");'));

    expect(result.ok).toBe(true);
    expect(sleepMs).toHaveBeenCalledTimes(4);
    expect(sleepMs).toHaveBeenNthCalledWith(1, 100);
    expect(sleepMs).toHaveBeenNthCalledWith(2, 100);
    expect(sleepMs).toHaveBeenNthCalledWith(3, 100);
    expect(sleepMs).toHaveBeenNthCalledWith(4, 100);
  });

  it('throttles successful relay mutations', async () => {
    const transport = new RecordingTransport();
    const sleepMs = vi.fn<(_durationMs: number) => Promise<void>>(() =>
      Promise.resolve()
    );
    const client = new RpcShellyClient(transport, {
      mutationDelayMs: 25,
      sleepMs
    });

    expect((await client.setRelayOn()).ok).toBe(true);
    expect((await client.setRelayOff()).ok).toBe(true);

    expect(sleepMs).toHaveBeenCalledTimes(2);
    expect(sleepMs).toHaveBeenNthCalledWith(1, 25);
    expect(sleepMs).toHaveBeenNthCalledWith(2, 25);
    expect(
      transport.requests
        .filter((request) => request.method === RPC_METHODS.SwitchSet)
        .map((request) => request.params)
    ).toEqual([
      { id: 0, on: true },
      { id: 0, on: false }
    ]);
  });

  it('throttles Switch.Set commands during safe relay test', async () => {
    const transport = new RecordingTransport();
    const sleepMs = vi.fn<(_durationMs: number) => Promise<void>>(() =>
      Promise.resolve()
    );
    const client = new RpcShellyClient(transport, {
      mutationDelayMs: 30,
      sleepMs
    });

    const result = await client.safeRelayTest({ onDurationMs: 0 });

    expect(result.ok).toBe(true);
    expect(sleepMs).toHaveBeenCalledTimes(2);
    expect(sleepMs).toHaveBeenNthCalledWith(1, 30);
    expect(sleepMs).toHaveBeenNthCalledWith(2, 30);
  });

  it('installs the BLE discovery script without enabling run on boot', async () => {
    const transport = new RecordingTransport();
    const client = new RpcShellyClient(transport);
    const result = await client.installScript(
      createBleDiscoveryInstallPlan('print("scan");')
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.scriptHash).toBeDefined();
    expect(transport.requests).toContainEqual({
      method: RPC_METHODS.ScriptCreate,
      params: { name: LOCAL_CLIMATE_LINK_BLE_DISCOVERY_SCRIPT_NAME }
    });
    expect(
      transport.requests.find((request) => request.method === RPC_METHODS.ScriptSetConfig)
        ?.params
    ).toEqual({ id: 4, config: { enable: false } });
  });

  it('reuses an existing script, backs up code, and stops it before upload', async () => {
    const transport = new RecordingTransport({
      scripts: [
        {
          id: 7,
          name: LOCAL_CLIMATE_LINK_SCRIPT_NAME,
          enable: true,
          running: true,
          code: 'print("old");'
        }
      ]
    });
    const client = new RpcShellyClient(transport);
    const result = await client.installScript(createInstallPlan('print("new");'));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.scriptId).toBe(7);
    expect(result.value.backup?.code).toBe('print("old");');
    expect(transport.requests.map((request) => request.method)).toEqual([
      RPC_METHODS.ShellyGetDeviceInfo,
      RPC_METHODS.ShellyGetStatus,
      RPC_METHODS.ScriptList,
      RPC_METHODS.ScriptGetCode,
      RPC_METHODS.ScriptEval,
      RPC_METHODS.ScriptStop,
      RPC_METHODS.ScriptPutCode,
      RPC_METHODS.ScriptSetConfig,
      RPC_METHODS.ScriptStart,
      RPC_METHODS.ScriptGetStatus
    ]);
    const cleanupEval = transport.requests.find(
      (request) => request.method === RPC_METHODS.ScriptEval
    );
    expect(cleanupEval?.params).toEqual({
      id: 7,
      code: expect.stringContaining('BLE.Scanner.stop||BLE.Scanner.Stop')
    });
    expect(
      transport.requests.some((request) => request.method === RPC_METHODS.ScriptCreate)
    ).toBe(false);
  });

  it('uses byte offsets when backing up existing non-ASCII script code', async () => {
    const existingCode = 'print("zażółć");';
    const transport = new RecordingTransport({
      scripts: [
        {
          id: 7,
          name: LOCAL_CLIMATE_LINK_SCRIPT_NAME,
          enable: true,
          running: false,
          code: existingCode
        }
      ]
    });
    const client = new RpcShellyClient(transport);
    const result = await client.installScript({
      ...createInstallPlan('print("new");'),
      chunkSizeBytes: 8
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.backup?.code).toBe(existingCode);
    expect(
      transport.requests
        .filter((request) => request.method === RPC_METHODS.ScriptGetCode)
        .map((request) => request.params)
    ).toEqual([
      { id: 7, offset: 0, len: 8 },
      { id: 7, offset: 8, len: 8 },
      { id: 7, offset: 15, len: 8 }
    ]);
  });

  it('uploads script code in 1024-byte chunks by default', async () => {
    const transport = new RecordingTransport();
    const client = new RpcShellyClient(transport);
    const result = await client.installScript(createInstallPlan('x'.repeat(2050)));

    expect(result.ok).toBe(true);
    const putCodeRequests = transport.requests.filter(
      (request) => request.method === RPC_METHODS.ScriptPutCode
    );
    expect(putCodeRequests).toHaveLength(3);
    expect(putCodeRequests.map((request) => request.params)).toEqual([
      { id: 4, code: 'x'.repeat(1024), append: false },
      { id: 4, code: 'x'.repeat(1024), append: true },
      { id: 4, code: 'x'.repeat(2), append: true }
    ]);
  });

  it('blocks install when Matter is enabled before script upload starts', async () => {
    const transport = new RecordingTransport({ matterEnabled: true });
    const client = new RpcShellyClient(transport);
    const result = await client.installScript(createInstallPlan('print("demo");'));

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('matter-enabled');
    expect(transport.requests.map((request) => request.method)).toEqual([
      RPC_METHODS.ShellyGetDeviceInfo,
      RPC_METHODS.ShellyGetStatus
    ]);
  });

  it('allows install when GetStatus omits Scripts but Script.List works', async () => {
    const transport = new RecordingTransport({ scriptComponent: null });
    const client = new RpcShellyClient(transport);

    const status = await client.getStatus();
    const install = await client.installScript(createInstallPlan('print("demo");'));

    expect(status.ok && status.value.scripts).toBe('missing');
    expect(install.ok).toBe(true);
  });

  it('blocks install when Script.List is unavailable', async () => {
    const transport = new RecordingTransport({ failScriptList: true });
    const client = new RpcShellyClient(transport);

    const install = await client.installScript(createInstallPlan('print("demo");'));

    expect(install.ok).toBe(false);
    if (install.ok) {
      return;
    }
    expect(install.error.kind).toBe('script-upload-failed');
    expect(install.error.technicalMessage).toContain('Script.List failed');
  });

  it('treats missing BLE component as a blocked capability', async () => {
    const transport = new RecordingTransport({
      bleComponent: null
    });
    const client = new RpcShellyClient(transport);

    const status = await client.getStatus();
    const install = await client.installScript(createInstallPlan('print("demo");'));

    expect(status.ok && status.value.bluetooth).toBe('missing');
    expect(install.ok).toBe(false);
    if (install.ok) {
      return;
    }
    expect(install.error.kind).toBe('script-upload-failed');
    expect(install.error.technicalMessage).toContain('BLE component');
  });

  it('blocks install when Shelly BLE is missing or disabled', async () => {
    const missingBle = new RpcShellyClient(
      new RecordingTransport({ bleComponent: null })
    );
    const disabledBle = new RpcShellyClient(
      new RecordingTransport({ bleComponent: { enable: false } })
    );

    const missingResult = await missingBle.installScript(
      createInstallPlan('print("demo");')
    );
    const disabledResult = await disabledBle.installScript(
      createInstallPlan('print("demo");')
    );

    expect(missingResult.ok).toBe(false);
    expect(disabledResult.ok).toBe(false);
    if (!missingResult.ok) {
      expect(missingResult.error.technicalMessage).toContain('BLE component');
    }
    if (!disabledResult.ok) {
      expect(disabledResult.error.technicalMessage).toContain('BLE is disabled');
    }
  });

  it('fails install when Script.GetStatus does not confirm running', async () => {
    const transport = new RecordingTransport({ scriptRunning: false });
    const client = new RpcShellyClient(transport);
    const result = await client.installScript(createInstallPlan('print("demo");'));

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('script-upload-failed');
  });

  it('safe relay test ends OFF', async () => {
    const transport = new RecordingTransport();
    const client = new RpcShellyClient(transport);
    const result = await client.safeRelayTest({ onDurationMs: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.finalRelayOn).toBe(false);
    expect(transport.relayOn).toBe(false);
  });

  it('can stop and start scripts and control relay state', async () => {
    const transport = new RecordingTransport();
    const client = new RpcShellyClient(transport);

    expect((await client.stopScript(1)).ok).toBe(true);
    expect((await client.startScript(1)).ok).toBe(true);
    expect((await client.setRelayOn()).ok).toBe(true);
    expect((await client.setRelayOff()).ok).toBe(true);

    expect(transport.requests.map((request) => request.method)).toEqual([
      RPC_METHODS.ScriptStop,
      RPC_METHODS.ScriptStart,
      RPC_METHODS.SwitchSet,
      RPC_METHODS.SwitchSet
    ]);
    expect(transport.requests.at(-2)?.params).toEqual({ id: 0, on: true });
    expect(transport.requests.at(-1)?.params).toEqual({ id: 0, on: false });
  });

  it('validates script and relay ids before control commands', async () => {
    const transport = new RecordingTransport();
    const client = new RpcShellyClient(transport);

    expect((await client.stopScript(-1)).ok).toBe(false);
    expect((await client.startScript(1.5)).ok).toBe(false);
    expect((await client.setRelayOn({ relayId: -1 })).ok).toBe(false);
    expect((await client.setRelayOff({ relayId: 1.5 })).ok).toBe(false);
    expect(transport.requests).toHaveLength(0);
  });

  it('reports an error when final OFF command cannot be confirmed', async () => {
    const transport = new RecordingTransport({ failOffCommand: true });
    const client = new RpcShellyClient(transport);
    const result = await client.safeRelayTest({ onDurationMs: 0 });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('relay-test-failed');
    expect(result.error.technicalMessage).toContain('final state could not be confirmed');
  });

  it('sends OFF even when the ON command fails', async () => {
    const transport = new RecordingTransport({ failOnCommand: true });
    const client = new RpcShellyClient(transport);
    const result = await client.safeRelayTest({ onDurationMs: 0 });

    expect(result.ok).toBe(false);
    expect(
      transport.requests
        .filter((request) => request.method === RPC_METHODS.SwitchSet)
        .map((request) => request.params)
    ).toEqual([
      { id: 0, on: true },
      { id: 0, on: false }
    ]);
    expect(transport.relayOn).toBe(false);
  });
});

describe('withTimeout', () => {
  it('returns timeout errors', async () => {
    const result = await withTimeout(new Promise(() => undefined), 1);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('timeout');
  });
});

describe('FetchShellyRpcTransport', () => {
  it('binds the default browser fetch to globalThis', async () => {
    const originalFetch = globalThis.fetch;
    const requestBodies: unknown[] = [];
    const strictFetch: typeof fetch = async function (
      this: typeof globalThis,
      _input,
      init
    ) {
      expect(this).toBe(globalThis);
      requestBodies.push(JSON.parse(String(init?.body)));
      return jsonResponse({ id: 1, result: { ok: true } });
    };

    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: strictFetch
    });

    try {
      const transport = new FetchShellyRpcTransport({
        baseUrl: 'http://192.168.1.50'
      });

      const result = await transport.call<{ ok: boolean }>({
        method: RPC_METHODS.ShellyGetStatus
      });

      expect(result.ok).toBe(true);
      expect(result.ok && result.value.ok).toBe(true);
      expect(requestBodies).toEqual([{ id: 1, method: RPC_METHODS.ShellyGetStatus }]);
    } finally {
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: originalFetch
      });
    }
  });

  it('unwraps Shelly JSON-RPC result envelopes and sends request id', async () => {
    const requestBodies: unknown[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      requestBodies.push(JSON.parse(String(init?.body)));
      return jsonResponse({ id: 1, result: { answer: 42 } });
    };
    const transport = new FetchShellyRpcTransport({
      baseUrl: 'http://192.168.1.50',
      fetchImpl
    });

    const result = await transport.call<{ answer: number }>({
      method: RPC_METHODS.ShellyGetStatus,
      params: { id: 0 }
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.answer).toBe(42);
    expect(requestBodies).toEqual([
      { id: 1, method: RPC_METHODS.ShellyGetStatus, params: { id: 0 } }
    ]);
  });

  it('unwraps Shelly event-style params envelopes', async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({ id: 1, src: 'shellyplugs-test', params: { running: true } });
    const transport = new FetchShellyRpcTransport({
      baseUrl: 'http://192.168.1.50',
      fetchImpl
    });

    const result = await transport.call<{ running: boolean }>({
      method: RPC_METHODS.ScriptGetStatus
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.running).toBe(true);
  });

  it('passes through direct object responses for endpoint-style transports', async () => {
    const fetchImpl: typeof fetch = async () => jsonResponse({ id: 4, running: true });
    const transport = new FetchShellyRpcTransport({
      baseUrl: 'http://192.168.1.50',
      fetchImpl
    });

    const result = await transport.call<{ id: number; running: boolean }>({
      method: RPC_METHODS.ScriptGetStatus
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toEqual({ id: 4, running: true });
  });

  it('returns typed errors for Shelly error envelopes', async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({ id: 1, error: { code: -103, message: 'Invalid argument' } });
    const transport = new FetchShellyRpcTransport({
      baseUrl: 'http://192.168.1.50',
      fetchImpl
    });

    const result = await transport.call({ method: RPC_METHODS.ScriptStart });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('unknown');
    expect(result.error.technicalMessage).toBe('Invalid argument');
  });

  it('returns typed errors for non-2xx HTTP responses', async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse(
        { error: { message: 'server failed' } },
        { ok: false, status: 500, statusText: 'Internal Server Error' }
      );
    const transport = new FetchShellyRpcTransport({
      baseUrl: 'http://192.168.1.50',
      fetchImpl
    });

    const result = await transport.call({ method: RPC_METHODS.ShellyGetStatus });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('unknown');
    expect(result.error.technicalMessage).toContain('HTTP 500');
  });

  it('returns a clear memory error when Shelly RPC reports out_of_memory', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response('out_of_memory', {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'content-type': 'text/plain' }
      });
    const transport = new FetchShellyRpcTransport({
      baseUrl: 'http://192.168.1.50',
      fetchImpl
    });

    const result = await transport.call({ method: RPC_METHODS.ScriptPutCode });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('script-upload-failed');
    expect(result.error.technicalMessage).toContain('out_of_memory');
  });

  it('returns typed errors for non-JSON Shelly RPC responses', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response('<!doctype html><html></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' }
      });
    const transport = new FetchShellyRpcTransport({
      baseUrl: 'http://192.168.1.50',
      fetchImpl
    });

    const result = await transport.call({ method: RPC_METHODS.ShellyGetStatus });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('validation-failed');
    expect(result.error.userMessageKey).toBe('errors.shellyInvalidResponse');
    expect(result.error.technicalMessage).toContain('non-JSON');
  });

  it('returns timeout errors when fetch is aborted', async () => {
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    const transport = new FetchShellyRpcTransport({
      baseUrl: 'http://192.168.1.50',
      defaultTimeoutMs: 1,
      fetchImpl
    });

    const result = await transport.call({ method: RPC_METHODS.ShellyGetStatus });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('timeout');
  });

  it('cancels fetch when the external signal is aborted', async () => {
    const controller = new AbortController();
    const fetchSignals: AbortSignal[] = [];
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        if (init?.signal) {
          fetchSignals.push(init.signal);
        }
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    const transport = new FetchShellyRpcTransport({
      baseUrl: 'http://192.168.1.50',
      defaultTimeoutMs: 1000,
      fetchImpl,
      signal: controller.signal
    });

    const resultPromise = transport.call({ method: RPC_METHODS.ShellyGetStatus });
    controller.abort();
    const result = await resultPromise;

    expect(fetchSignals[0]?.aborted).toBe(true);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('timeout');
    expect(result.error.retryable).toBe(false);
    expect(result.error.technicalMessage).toBe('Shelly RPC request was canceled.');
  });

  it('uses incrementing numeric request ids', async () => {
    const requestBodies: Array<{ id: number; method: string }> = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      requestBodies.push(
        JSON.parse(String(init?.body)) as { id: number; method: string }
      );
      return jsonResponse({ result: {} });
    };
    const transport = new FetchShellyRpcTransport({
      baseUrl: 'http://192.168.1.50',
      fetchImpl
    });

    await transport.call({ method: RPC_METHODS.ShellyGetStatus });
    await transport.call({ method: RPC_METHODS.ScriptList });

    expect(requestBodies.map((body) => body.id)).toEqual([1, 2]);
  });

  it('supports RpcShellyClient install flow with Shelly-style params envelopes', async () => {
    const requestBodies: Array<{ id: number; method: string; params?: unknown }> = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        id: number;
        method: string;
        params?: unknown;
      };
      requestBodies.push(body);

      const paramsByMethod: Record<string, unknown> = {
        [RPC_METHODS.ShellyGetDeviceInfo]: {
          model: 'S3PL-00112EU',
          gen: 3,
          matter: false
        },
        [RPC_METHODS.ShellyGetStatus]: {
          'switch:0': { output: false },
          matter: false,
          script: true,
          ble: true
        },
        [RPC_METHODS.ScriptList]: { scripts: [] },
        [RPC_METHODS.ScriptCreate]: { id: 4 },
        [RPC_METHODS.ScriptPutCode]: {},
        [RPC_METHODS.ScriptSetConfig]: {},
        [RPC_METHODS.ScriptStart]: {},
        [RPC_METHODS.ScriptGetStatus]: {
          id: 4,
          running: true,
          mem_used: 12,
          mem_free: 34
        }
      };

      return jsonResponse({
        id: body.id,
        src: 'shellyplugs-test',
        params: paramsByMethod[body.method] ?? {}
      });
    };
    const transport = new FetchShellyRpcTransport({
      baseUrl: 'http://192.168.1.50',
      fetchImpl
    });
    const client = new RpcShellyClient(transport);

    const result = await client.installScript(createInstallPlan('print("safe off");'));

    expect(result.ok).toBe(true);
    expect(requestBodies.map((body) => body.method)).toEqual([
      RPC_METHODS.ShellyGetDeviceInfo,
      RPC_METHODS.ShellyGetStatus,
      RPC_METHODS.ScriptList,
      RPC_METHODS.ScriptCreate,
      RPC_METHODS.ScriptPutCode,
      RPC_METHODS.ScriptSetConfig,
      RPC_METHODS.ScriptStart,
      RPC_METHODS.ScriptGetStatus
    ]);
    expect(requestBodies.map((body) => body.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('FakeShellyClient', () => {
  it('uploads scripts successfully in normal demo mode', async () => {
    const client = new FakeShellyClient({ sleepMs: () => Promise.resolve() });
    const result = await client.installScript(createInstallPlan('print("demo");'));

    expect(result.ok).toBe(true);
    expect(client.wasScriptUploaded()).toBe(true);
  });

  it('blocks install when Matter is enabled', async () => {
    const client = new FakeShellyClient({ matterEnabled: true });
    const result = await client.installScript(createInstallPlan('print("demo");'));

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('matter-enabled');
  });

  it('parses plug telemetry from Shelly status', async () => {
    const transport = new RecordingTransport({
      switchStatus: {
        apower: 28.4,
        voltage: 230.1,
        current: 0.12,
        aenergy: { total: 1234 },
        temperature: { tC: 31.2 }
      },
      wifiStatus: { rssi: -54 }
    });
    const client = new RpcShellyClient(transport);

    const status = await client.getStatus();

    expect(status.ok && status.value.telemetry).toEqual({
      powerW: 28.4,
      voltageV: 230.1,
      currentA: 0.12,
      energyWh: 1234,
      deviceTemperatureC: 31.2,
      wifiRssiDbm: -54
    });
  });

  it('parses Shelly clock status from sys status', async () => {
    const transport = new RecordingTransport({
      sysStatus: {
        time: '10:14',
        unixtime: 1_782_806_040,
        uptime: 81234,
        last_sync_ts: 1_782_800_000
      }
    });
    const client = new RpcShellyClient(transport);

    const status = await client.getStatus();

    expect(status.ok && status.value.clock).toEqual({
      localTime: '10:14',
      unixTimeSec: 1_782_806_040,
      uptimeSec: 81234,
      lastSyncUnixTimeSec: 1_782_800_000,
      timeSynced: true
    });
  });

  it('safe relay test always ends OFF after simulated success', async () => {
    const client = new FakeShellyClient({ sleepMs: () => Promise.resolve() });
    const result = await client.safeRelayTest({ onDurationMs: 0 });
    const status = await client.getStatus();

    expect(result.ok).toBe(true);
    expect(status.ok && status.value.relayOn).toBe(false);
  });
});
