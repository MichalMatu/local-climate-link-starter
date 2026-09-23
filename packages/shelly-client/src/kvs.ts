import { RPC_METHODS, type Result, type ShellyRpcTransport } from './model.js';
import { validationError } from './rpc/errors.js';

export interface ShellyKvsItem {
  key: string;
  etag: string;
  value: unknown;
}

export interface ShellyKvsValue {
  etag: string;
  value: unknown;
}

export interface ShellyKvsSetResult {
  etag: string;
  rev: number;
}

export interface ShellyKvsDeleteResult {
  rev: number;
}

export interface ShellyKvsListResult {
  keys: Readonly<Record<string, { etag: string }>>;
  rev: number;
}

export interface ShellyKvsPage {
  items: readonly ShellyKvsItem[];
  offset: number;
  total: number;
}

const validateKey = (key: string): Result<string> => {
  if (key.length === 0 || key.length > 42) {
    return { ok: false, error: validationError('KVS key must contain 1 to 42 characters.') };
  }
  return { ok: true, value: key };
};

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const parseKvsValue = (value: unknown): Result<ShellyKvsValue> => {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, error: validationError('Invalid KVS.Get response.') };
  }
  const candidate = value as { etag?: unknown; value?: unknown };
  if (typeof candidate.etag !== 'string' || !('value' in candidate)) {
    return { ok: false, error: validationError('Invalid KVS.Get response.') };
  }
  return { ok: true, value: { etag: candidate.etag, value: candidate.value } };
};

const parseSetResult = (value: unknown): Result<ShellyKvsSetResult> => {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, error: validationError('Invalid KVS.Set response.') };
  }
  const candidate = value as { etag?: unknown; rev?: unknown };
  if (typeof candidate.etag !== 'string' || !isNonNegativeInteger(candidate.rev)) {
    return { ok: false, error: validationError('Invalid KVS.Set response.') };
  }
  return { ok: true, value: { etag: candidate.etag, rev: candidate.rev } };
};

const parseDeleteResult = (value: unknown): Result<ShellyKvsDeleteResult> => {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, error: validationError('Invalid KVS.Delete response.') };
  }
  const rev = (value as { rev?: unknown }).rev;
  return isNonNegativeInteger(rev)
    ? { ok: true, value: { rev } }
    : { ok: false, error: validationError('Invalid KVS.Delete response.') };
};

const parseListResult = (value: unknown): Result<ShellyKvsListResult> => {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, error: validationError('Invalid KVS.List response.') };
  }
  const candidate = value as { keys?: unknown; rev?: unknown };
  if (
    typeof candidate.keys !== 'object' ||
    candidate.keys === null ||
    Array.isArray(candidate.keys) ||
    !isNonNegativeInteger(candidate.rev)
  ) {
    return { ok: false, error: validationError('Invalid KVS.List response.') };
  }
  const keys: Record<string, { etag: string }> = {};
  for (const [key, rawEntry] of Object.entries(candidate.keys)) {
    if (typeof rawEntry !== 'object' || rawEntry === null) {
      return { ok: false, error: validationError('Invalid KVS.List entry.') };
    }
    const etag = (rawEntry as { etag?: unknown }).etag;
    if (typeof etag !== 'string') {
      return { ok: false, error: validationError('Invalid KVS.List entry.') };
    }
    keys[key] = { etag };
  }
  return { ok: true, value: { keys, rev: candidate.rev } };
};

const parseArrayItem = (value: unknown): ShellyKvsItem | null => {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as { key?: unknown; etag?: unknown; value?: unknown };
  if (
    typeof candidate.key !== 'string' ||
    typeof candidate.etag !== 'string' ||
    !('value' in candidate)
  ) {
    return null;
  }
  return { key: candidate.key, etag: candidate.etag, value: candidate.value };
};

const parseGetManyItems = (value: unknown): readonly ShellyKvsItem[] | null => {
  if (Array.isArray(value)) {
    const items: ShellyKvsItem[] = [];
    for (const rawItem of value) {
      const item = parseArrayItem(rawItem);
      if (!item) return null;
      items.push(item);
    }
    return items;
  }
  if (typeof value === 'object' && value !== null) {
    const items: ShellyKvsItem[] = [];
    for (const [key, rawItem] of Object.entries(value)) {
      if (typeof rawItem !== 'object' || rawItem === null) return null;
      const candidate = rawItem as { etag?: unknown; value?: unknown };
      if (typeof candidate.etag !== 'string' || !('value' in candidate)) return null;
      items.push({ key, etag: candidate.etag, value: candidate.value });
    }
    return items;
  }
  return null;
};

const parseGetManyResult = (value: unknown): Result<ShellyKvsPage> => {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, error: validationError('Invalid KVS.GetMany response.') };
  }
  const candidate = value as { items?: unknown; offset?: unknown; total?: unknown };
  const items = parseGetManyItems(candidate.items);
  if (
    items === null ||
    !isNonNegativeInteger(candidate.offset) ||
    !isNonNegativeInteger(candidate.total)
  ) {
    return { ok: false, error: validationError('Invalid KVS.GetMany response.') };
  }
  return {
    ok: true,
    value: { items, offset: candidate.offset, total: candidate.total }
  };
};

export class ShellyKvsClient {
  constructor(private readonly transport: ShellyRpcTransport) {}

  async get(key: string): Promise<Result<ShellyKvsValue>> {
    const validKey = validateKey(key);
    if (!validKey.ok) return validKey;
    const response = await this.transport.call<unknown>({
      method: RPC_METHODS.KvsGet,
      params: { key: validKey.value }
    });
    return response.ok ? parseKvsValue(response.value) : response;
  }

  async set(key: string, value: unknown, etag?: string): Promise<Result<ShellyKvsSetResult>> {
    const validKey = validateKey(key);
    if (!validKey.ok) return validKey;
    const params: { key: string; value: unknown; etag?: string } = {
      key: validKey.value,
      value
    };
    if (etag !== undefined) params.etag = etag;
    const response = await this.transport.call<unknown>({
      method: RPC_METHODS.KvsSet,
      params
    });
    return response.ok ? parseSetResult(response.value) : response;
  }

  async delete(key: string, etag?: string): Promise<Result<ShellyKvsDeleteResult>> {
    const validKey = validateKey(key);
    if (!validKey.ok) return validKey;
    const params: { key: string; etag?: string } = { key: validKey.value };
    if (etag !== undefined) params.etag = etag;
    const response = await this.transport.call<unknown>({
      method: RPC_METHODS.KvsDelete,
      params
    });
    return response.ok ? parseDeleteResult(response.value) : response;
  }

  async list(match?: string): Promise<Result<ShellyKvsListResult>> {
    const response = await this.transport.call<unknown>({
      method: RPC_METHODS.KvsList,
      ...(match === undefined ? {} : { params: { match } })
    });
    return response.ok ? parseListResult(response.value) : response;
  }

  async getMany(match = '*', offset = 0): Promise<Result<ShellyKvsPage>> {
    if (!isNonNegativeInteger(offset)) {
      return { ok: false, error: validationError('KVS.GetMany offset must be non-negative.') };
    }
    const response = await this.transport.call<unknown>({
      method: RPC_METHODS.KvsGetMany,
      params: { match, offset }
    });
    return response.ok ? parseGetManyResult(response.value) : response;
  }

  async getAllMatching(match: string, maxPages = 50): Promise<Result<readonly ShellyKvsItem[]>> {
    if (!isNonNegativeInteger(maxPages) || maxPages < 1) {
      return { ok: false, error: validationError('KVS page limit must be a positive integer.') };
    }
    const all: ShellyKvsItem[] = [];
    let offset = 0;
    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
      const page = await this.getMany(match, offset);
      if (!page.ok) return page;
      all.push(...page.value.items);
      if (all.length >= page.value.total) return { ok: true, value: all };
      const nextOffset = page.value.offset + page.value.items.length;
      if (nextOffset <= offset) {
        return { ok: false, error: validationError('KVS.GetMany pagination made no progress.') };
      }
      offset = nextOffset;
    }
    return { ok: false, error: validationError('KVS.GetMany exceeded the page safety limit.') };
  }
}
