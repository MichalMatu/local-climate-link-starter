import { create } from 'zustand';
import type { z } from 'zod';
import type { RegistryRepository } from './repository.js';
import type { RegistryError, RegistryResult } from './result.js';

type RegistryItem = { id: string; createdAtMs: number; updatedAtMs: number };
export type RegistryState<T> = {
  items: T[];
  loadError: RegistryError | null;
  upsert(input: unknown): RegistryResult<T>;
  remove(id: string): RegistryResult<null>;
};

// Factories inject current reference readers; no store imports another store.
export const createRegistryStore = <T extends RegistryItem>({
  repository,
  schema,
  beforeUpsert,
  beforeRemove
}: {
  repository: RegistryRepository<T>;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  beforeUpsert(
    item: T,
    existing: T | undefined,
    items: readonly T[]
  ): RegistryResult<null>;
  beforeRemove(id: string, items: readonly T[]): RegistryResult<null>;
}) =>
  create<RegistryState<T>>((set, get) => {
    const loaded = repository.load();
    const persist = (items: T[]): RegistryResult<null> => {
      const result = repository.save(items);
      if (result.ok) set({ items });
      return result;
    };
    return {
      items: loaded.ok ? loaded.value : [],
      loadError: loaded.ok ? null : loaded.error,
      upsert: (input) => {
        const { items, loadError } = get();
        if (loadError) return { ok: false, error: loadError };
        const parsed = schema.safeParse(input);
        if (!parsed.success) return { ok: false, error: { kind: 'validation-failed' } };
        const existing = items.find((item) => item.id === parsed.data.id);
        const checked = beforeUpsert(parsed.data, existing, items);
        if (!checked.ok) return checked;
        const item = {
          ...parsed.data,
          createdAtMs: existing?.createdAtMs ?? parsed.data.createdAtMs
        };
        const next = [
          item,
          ...items.filter((candidate) => candidate.id !== item.id)
        ].sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        const saved = persist(next);
        return saved.ok ? { ok: true, value: item } : saved;
      },
      remove: (id) => {
        const { items, loadError } = get();
        if (loadError) return { ok: false, error: loadError };
        const checked = beforeRemove(id, items);
        return checked.ok ? persist(items.filter((item) => item.id !== id)) : checked;
      }
    };
  });
