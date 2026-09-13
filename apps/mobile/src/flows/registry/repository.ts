import { z } from 'zod';
import type { RegistryResult } from './result.js';

export type RegistryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export interface RegistryRepository<T> {
  load(): RegistryResult<T[]>;
  save(items: readonly T[]): RegistryResult<null>;
}

const browserStorage = (): RegistryStorage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const createRegistryRepository = <T extends { id: string }>(
  key: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  storage: RegistryStorage | null = browserStorage()
): RegistryRepository<T> => {
  const payloadSchema = z
    .object({ version: z.literal(1), items: z.array(schema) })
    .strict()
    .refine(({ items }) => new Set(items.map((item) => item.id)).size === items.length);
  return {
    load: () => {
      if (!storage) return { ok: false, error: { kind: 'storage-unavailable' } };
      let stored: string | null;
      try {
        stored = storage.getItem(key);
      } catch {
        return { ok: false, error: { kind: 'storage-unavailable' } };
      }
      if (stored === null) return { ok: true, value: [] };
      try {
        const parsed = payloadSchema.safeParse(JSON.parse(stored));
        return parsed.success
          ? { ok: true, value: parsed.data.items }
          : { ok: false, error: { kind: 'storage-invalid' } };
      } catch {
        return { ok: false, error: { kind: 'storage-invalid' } };
      }
    },
    save: (items) => {
      if (!storage) return { ok: false, error: { kind: 'storage-unavailable' } };
      const parsed = payloadSchema.safeParse({ version: 1, items });
      if (!parsed.success) return { ok: false, error: { kind: 'validation-failed' } };
      try {
        storage.setItem(key, JSON.stringify(parsed.data));
        return { ok: true, value: null };
      } catch {
        return { ok: false, error: { kind: 'storage-unavailable' } };
      }
    }
  };
};
