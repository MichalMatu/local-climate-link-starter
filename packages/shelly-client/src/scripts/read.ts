import {
  RPC_METHODS,
  type Result,
  type ShellyClientError,
  type ShellyRpcTransport
} from '../model.js';
import {
  scriptCodeResponseSchema,
  scriptListResponseSchema,
  type ShellyScriptListEntry
} from '../rpc/validators.js';

const DEFAULT_SCRIPT_READ_CHUNK_SIZE_BYTES = 1024;

const validationError = (message: string): ShellyClientError => ({
  kind: 'validation-failed',
  userMessageKey: 'errors.validationFailed',
  technicalMessage: message,
  retryable: false
});

const validScriptId = (scriptId: number): Result<number> =>
  Number.isInteger(scriptId) && scriptId >= 0
    ? { ok: true, value: scriptId }
    : {
        ok: false,
        error: validationError(`Invalid Shelly script id: ${scriptId}.`)
      };

const validChunkSize = (chunkSizeBytes: number): Result<number> =>
  Number.isInteger(chunkSizeBytes) && chunkSizeBytes > 0
    ? { ok: true, value: chunkSizeBytes }
    : {
        ok: false,
        error: validationError(
          `Invalid Shelly script read chunk size: ${chunkSizeBytes}.`
        )
      };

export const readShellyScriptList = async (
  transport: ShellyRpcTransport
): Promise<Result<ShellyScriptListEntry[]>> => {
  const response = await transport.call<unknown>({ method: RPC_METHODS.ScriptList });
  if (!response.ok) {
    return response;
  }

  const parsed = scriptListResponseSchema.safeParse(response.value);
  return parsed.success
    ? { ok: true, value: parsed.data.scripts }
    : { ok: false, error: validationError(parsed.error.message) };
};

export const readShellyScriptCode = async (
  transport: ShellyRpcTransport,
  scriptId: number,
  options: { chunkSizeBytes?: number } = {}
): Promise<Result<string>> => {
  const parsedScriptId = validScriptId(scriptId);
  if (!parsedScriptId.ok) {
    return parsedScriptId;
  }
  const parsedChunkSize = validChunkSize(
    options.chunkSizeBytes ?? DEFAULT_SCRIPT_READ_CHUNK_SIZE_BYTES
  );
  if (!parsedChunkSize.ok) {
    return parsedChunkSize;
  }

  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let offset = 0;
  let left = 0;

  do {
    const response = await transport.call<unknown>({
      method: RPC_METHODS.ScriptGetCode,
      params: {
        id: parsedScriptId.value,
        offset,
        len: parsedChunkSize.value
      }
    });
    if (!response.ok) {
      return response;
    }

    const parsed = scriptCodeResponseSchema.safeParse(response.value);
    if (!parsed.success) {
      return { ok: false, error: validationError(parsed.error.message) };
    }
    if (parsed.data.left > 0 && parsed.data.data.length === 0) {
      return {
        ok: false,
        error: validationError(
          'Script.GetCode returned an empty chunk while bytes remained.'
        )
      };
    }

    chunks.push(parsed.data.data);
    offset += encoder.encode(parsed.data.data).length;
    left = parsed.data.left;
  } while (left > 0);

  return { ok: true, value: chunks.join('') };
};
