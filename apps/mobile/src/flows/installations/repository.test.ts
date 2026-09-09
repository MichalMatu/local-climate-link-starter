import { describe, expect, it, vi } from 'vitest';
import {
  createInstalledAutomationRepository,
  INSTALLED_AUTOMATIONS_STORAGE_KEY
} from './repository.js';

describe('installed automation repository resilience', () => {
  it('fails closed when browser storage is unavailable', () => {
    const repository = createInstalledAutomationRepository(null);

    expect(repository.load()).toEqual([]);
    expect(() => repository.save([])).not.toThrow();
    expect(() => repository.clear()).not.toThrow();
  });

  it('fails closed and warns when persisted JSON is malformed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const storage = {
      getItem: vi.fn(() => '{broken-json'),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    const repository = createInstalledAutomationRepository(storage);

    expect(repository.load()).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toBe('Installed automations storage read failed.');

    warn.mockRestore();
  });

  it('ignores persisted payloads from an unsupported schema version', () => {
    const storage = {
      getItem: vi.fn(() => JSON.stringify({ version: 999, installations: [] })),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    const repository = createInstalledAutomationRepository(storage);

    expect(repository.load()).toEqual([]);
  });

  it('keeps storage write failures from crashing the app', () => {
    const error = new Error('quota exceeded');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw error;
      }),
      removeItem: vi.fn()
    };
    const repository = createInstalledAutomationRepository(storage);

    expect(() => repository.save([])).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      'Installed automations storage write failed.',
      error
    );

    warn.mockRestore();
  });

  it('keeps storage clear failures from crashing the app', () => {
    const error = new Error('storage unavailable');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(() => {
        throw error;
      })
    };
    const repository = createInstalledAutomationRepository(storage);

    expect(() => repository.clear()).not.toThrow();
    expect(storage.removeItem).toHaveBeenCalledWith(INSTALLED_AUTOMATIONS_STORAGE_KEY);
    expect(warn).toHaveBeenCalledWith(
      'Installed automations storage clear failed.',
      error
    );

    warn.mockRestore();
  });
});
