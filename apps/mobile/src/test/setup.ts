import '@testing-library/jest-dom/vitest';

Object.defineProperty(globalThis.navigator, 'languages', {
  configurable: true,
  value: ['pl-PL', 'pl']
});

Object.defineProperty(globalThis.navigator, 'language', {
  configurable: true,
  value: 'pl-PL'
});
