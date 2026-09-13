import { describe, expect, it } from 'vitest';
import { climate, plug } from '../registry/fixtures.test-support.js';
import { requireRuleRelayOwnership } from './runtimeOwnership.js';

const verified = {
  relayOn: false,
  inventory: {
    status: 'verified' as const,
    plugId: plug.id,
    baseUrl: plug.baseUrl,
    scripts: [],
    schedules: []
  },
  ownership: { status: 'blocked' as const, conflicts: [], attention: [] },
  managedScripts: []
};

describe('rule runtime ownership guard', () => {
  it('allows the rule being edited to own its own saved relay', async () => {
    const value = await requireRuleRelayOwnership({
      rule: climate,
      plug,
      rules: [climate],
      readRuntime: async () => ({ ok: true, value: verified })
    });
    expect(value.ownership.status).toBe('no-conflict');
  });

  it('fails closed when inventory cannot be verified', async () => {
    await expect(
      requireRuleRelayOwnership({
        rule: climate,
        plug,
        rules: [climate],
        readRuntime: async () => ({ ok: false, error: { kind: 'offline' } }) as never
      })
    ).rejects.toMatchObject({ code: 'inventory-unavailable' });
  });
});
