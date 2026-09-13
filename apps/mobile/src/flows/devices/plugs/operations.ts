import { normalizePlugId } from './model.js';

/** One queue per physical plug, shared by device and rule lifecycle operations. */
export const createPlugOperationQueue = () => {
  const pending = new Map<string, Promise<void>>();
  return async <T>(plugId: string, operation: () => Promise<T>): Promise<T> => {
    const key = normalizePlugId(plugId);
    const previous = pending.get(key) ?? Promise.resolve();
    const result = previous.then(operation);
    const settled = result.then(
      () => undefined,
      () => undefined
    );
    pending.set(key, settled);
    try {
      return await result;
    } finally {
      if (pending.get(key) === settled) pending.delete(key);
    }
  };
};

export const runPlugOperation = createPlugOperationQueue();
