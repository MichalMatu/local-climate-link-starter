import '@testing-library/jest-dom/vitest';
import { timeoutManager } from '@tanstack/react-query';

const unrefTimeout = (callback: () => void, delay: number) => {
  const handle = setTimeout(callback, delay);
  handle.unref();
  return handle;
};

const unrefInterval = (callback: () => void, delay: number) => {
  const handle = setInterval(callback, delay);
  handle.unref();
  return handle;
};

timeoutManager.setTimeoutProvider({
  setTimeout: unrefTimeout,
  clearTimeout,
  setInterval: unrefInterval,
  clearInterval
});

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    }
  };
};

if (globalThis.window.localStorage === undefined) {
  Object.defineProperty(globalThis.window, 'localStorage', {
    configurable: true,
    value: createMemoryStorage()
  });
}

Object.defineProperty(globalThis.navigator, 'languages', {
  configurable: true,
  value: ['pl-PL', 'pl']
});

Object.defineProperty(globalThis.navigator, 'language', {
  configurable: true,
  value: 'pl-PL'
});
