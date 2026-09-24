import {
  RPC_METHODS,
  type Result,
  type ShellyClientError,
  type ShellyDeviceInfo,
  type ShellyInstallPlan,
  type ShellyInstallResult,
  type ShellyRpcRequest,
  type ShellyRpcTransport,
  type ShellyScriptBackup,
  type ShellyStatus
} from '../model.js';
import { validationError } from '../rpc/errors.js';
import { scriptCreateResponseSchema, scriptStatusSchema } from '../rpc/validators.js';
import { hashScriptCode } from './hash.js';
import { readShellyScriptCode, readShellyScriptList } from './read.js';

export const DEFAULT_PUT_CODE_CHUNK_SIZE_BYTES = 1024;
const BLE_SCANNER_CLEANUP_DELAY_MS = 1000;
const STOP_BLE_SCANNER_EVAL_CODE =
  'if(typeof BLE!=="undefined"&&BLE.Scanner){var s=BLE.Scanner.stop||BLE.Scanner.Stop;if(s)s.call(BLE.Scanner);}"ok"';

type MutationCaller = (request: ShellyRpcRequest) => Promise<Result<unknown>>;

type InstallLifecycle = {
  transport: ShellyRpcTransport;
  callMutation: MutationCaller;
  sleepMs(durationMs: number): Promise<void>;
  getDeviceInfo(): Promise<Result<ShellyDeviceInfo>>;
  getStatus(): Promise<Result<ShellyStatus>>;
};

const scriptUploadError = (message: string): ShellyClientError => ({
  kind: 'script-upload-failed',
  userMessageKey: 'errors.scriptUploadFailed',
  technicalMessage: message,
  retryable: true
});

const chunkUtf8String = (value: string, maxBytes: number): string[] => {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let chunk = '';
  let chunkBytes = 0;

  for (const character of value) {
    const characterBytes = encoder.encode(character).length;
    if (chunk !== '' && chunkBytes + characterBytes > maxBytes) {
      chunks.push(chunk);
      chunk = '';
      chunkBytes = 0;
    }
    chunk += character;
    chunkBytes += characterBytes;
  }

  if (chunk !== '') {
    return [...chunks, chunk];
  }

  return chunks.length > 0 ? chunks : [''];
};

const backupExistingScript = async (
  transport: ShellyRpcTransport,
  script: { id: number; name: string; enable: boolean; running: boolean },
  chunkSizeBytes: number
): Promise<ShellyScriptBackup> => {
  const backupBase = {
    scriptId: script.id,
    name: script.name,
    enable: script.enable,
    running: script.running
  };
  const codeResult = await readShellyScriptCode(transport, script.id, { chunkSizeBytes });
  if (!codeResult.ok) {
    return {
      ...backupBase,
      errorMessage:
        codeResult.error.technicalMessage ??
        `Script.GetCode failed with ${codeResult.error.kind}.`
    };
  }

  const code = codeResult.value;
  return {
    ...backupBase,
    code,
    codeHash: hashScriptCode(code)
  };
};

const stopBleScannerInScript = async (
  scriptId: number,
  callMutation: MutationCaller,
  sleepMs: InstallLifecycle['sleepMs']
): Promise<void> => {
  await callMutation({
    method: RPC_METHODS.ScriptEval,
    params: { id: scriptId, code: STOP_BLE_SCANNER_EVAL_CODE }
  });
  await sleepMs(BLE_SCANNER_CLEANUP_DELAY_MS);
};

const removeScripts = async (
  lifecycle: InstallLifecycle,
  scripts: Array<{ id: number; running: boolean }>
): Promise<Result<null>> => {
  for (const script of scripts) {
    if (script.running) {
      await stopBleScannerInScript(script.id, lifecycle.callMutation, lifecycle.sleepMs);
      const stopResult = await lifecycle.callMutation({
        method: RPC_METHODS.ScriptStop,
        params: { id: script.id }
      });
      if (!stopResult.ok) return stopResult;
    }

    const deleteResult = await lifecycle.callMutation({
      method: RPC_METHODS.ScriptDelete,
      params: { id: script.id }
    });
    if (!deleteResult.ok) return deleteResult;
  }

  return { ok: true, value: null };
};

export const installShellyScript = async (
  lifecycle: InstallLifecycle,
  plan: ShellyInstallPlan
): Promise<Result<ShellyInstallResult>> => {
  const [deviceInfo, status] = await Promise.all([
    lifecycle.getDeviceInfo(),
    lifecycle.getStatus()
  ]);
  if (!deviceInfo.ok) return deviceInfo;
  if (!status.ok) return status;

  if (deviceInfo.value.matterEnabled || status.value.matterEnabled) {
    return {
      ok: false,
      error: {
        kind: 'matter-enabled',
        userMessageKey: 'errors.matterEnabled',
        technicalMessage: 'Matter is enabled; Shelly Scripts are blocked.',
        retryable: false
      }
    };
  }

  const list = await readShellyScriptList(lifecycle.transport);
  if (!list.ok) {
    return {
      ok: false,
      error: scriptUploadError(
        `Script.List failed: ${list.error.technicalMessage ?? list.error.kind}`
      )
    };
  }

  if (status.value.scripts === 'disabled') {
    return {
      ok: false,
      error: scriptUploadError('Shelly Scripts are disabled on this device.')
    };
  }
  if (status.value.bluetooth !== 'enabled') {
    return {
      ok: false,
      error: scriptUploadError(
        status.value.bluetooth === 'missing'
          ? 'Shelly.GetStatus did not expose the BLE component.'
          : 'Shelly BLE is disabled on this device.'
      )
    };
  }

  const chunkSizeBytes = plan.chunkSizeBytes ?? DEFAULT_PUT_CODE_CHUNK_SIZE_BYTES;
  if (plan.replaceAllScripts) {
    const removed = await removeScripts(lifecycle, list.value);
    if (!removed.ok) return removed;
  }

  const existingScript = plan.replaceAllScripts
    ? undefined
    : list.value.find((script) => script.name === plan.scriptName);
  let backup: ShellyScriptBackup | undefined;
  let scriptId: number;

  if (existingScript) {
    backup = plan.backupExisting
      ? await backupExistingScript(lifecycle.transport, existingScript, chunkSizeBytes)
      : undefined;
    scriptId = existingScript.id;

    if (existingScript.running) {
      await stopBleScannerInScript(scriptId, lifecycle.callMutation, lifecycle.sleepMs);
      const stopResult = await lifecycle.callMutation({
        method: RPC_METHODS.ScriptStop,
        params: { id: scriptId }
      });
      if (!stopResult.ok) return stopResult;
    }
  } else {
    const created = await lifecycle.callMutation({
      method: RPC_METHODS.ScriptCreate,
      params: { name: plan.scriptName }
    });
    if (!created.ok) return created;

    const parsedCreate = scriptCreateResponseSchema.safeParse(created.value);
    if (!parsedCreate.success) {
      return { ok: false, error: validationError(parsedCreate.error.message) };
    }
    scriptId = parsedCreate.data.id;
  }

  const codeChunks = chunkUtf8String(plan.code, chunkSizeBytes);
  for (let index = 0; index < codeChunks.length; index += 1) {
    const putResult = await lifecycle.callMutation({
      method: RPC_METHODS.ScriptPutCode,
      params: {
        id: scriptId,
        code: codeChunks[index],
        append: index > 0
      }
    });
    if (!putResult.ok) return putResult;
  }

  const configResult = await lifecycle.callMutation({
    method: RPC_METHODS.ScriptSetConfig,
    params: { id: scriptId, config: { enable: plan.runOnBoot } }
  });
  if (!configResult.ok) return configResult;

  const startResult = await lifecycle.callMutation({
    method: RPC_METHODS.ScriptStart,
    params: { id: scriptId }
  });
  if (!startResult.ok) return startResult;

  const scriptStatus = await lifecycle.transport.call<unknown>({
    method: RPC_METHODS.ScriptGetStatus,
    params: { id: scriptId }
  });
  if (!scriptStatus.ok) return scriptStatus;

  const parsedStatus = scriptStatusSchema.safeParse(scriptStatus.value);
  if (!parsedStatus.success) {
    return { ok: false, error: validationError(parsedStatus.error.message) };
  }
  if (
    parsedStatus.data.running !== true ||
    parsedStatus.data.error !== undefined ||
    (parsedStatus.data.errors?.length ?? 0) > 0
  ) {
    return {
      ok: false,
      error: scriptUploadError('Script.GetStatus did not confirm a running script.')
    };
  }

  if (plan.replaceAllScripts) {
    const verifiedList = await readShellyScriptList(lifecycle.transport);
    if (!verifiedList.ok) return verifiedList;
    if (verifiedList.value.length !== 1 || verifiedList.value[0]?.id !== scriptId) {
      return {
        ok: false,
        error: scriptUploadError(
          'Shelly did not confirm exclusive ownership of the script runtime.'
        )
      };
    }
  }

  return {
    ok: true,
    value: {
      scriptId,
      running: parsedStatus.data.running ?? true,
      memUsed: parsedStatus.data.mem_used,
      memFree: parsedStatus.data.mem_free,
      scriptHash: hashScriptCode(plan.code),
      backup
    }
  };
};
