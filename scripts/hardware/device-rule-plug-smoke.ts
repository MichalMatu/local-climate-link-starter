import assert from 'node:assert/strict';
import {
  createDefaultShellyThermostatConfig,
  generateShellyThermostatScript
} from '@lcl/script-generator';
import {
  createInstallPlan,
  FetchShellyRpcTransport,
  RpcShellyClient,
  RpcShellyInventoryClient,
  RpcShellyScheduleClient
} from '@lcl/shelly-client';
import { checkPlugRegistration } from '../../apps/mobile/src/flows/devices/plugs/registration.js';
import { readPlugRuntime } from '../../apps/mobile/src/flows/devices/plugs/inventory.js';
import {
  deleteOrphanClimateScript,
  setUnownedPlugRelay
} from '../../apps/mobile/src/flows/devices/plugs/runtime.js';
import { createDeviceRuleRegistries } from '../../apps/mobile/src/flows/registry/devicesAndRules.js';

// Service-level smoke for the authorized development plug. No existing scripts
// or schedules are removed; the only remote artifact is this run's exact script.
const baseUrl = process.env.SHELLY_URL;
const expectedDeviceId = process.env.SHELLY_DEVICE_ID?.trim().toLowerCase();
assert(
  baseUrl && expectedDeviceId,
  'Set SHELLY_URL and SHELLY_DEVICE_ID for the development plug.'
);
const transport = new FetchShellyRpcTransport({ baseUrl });
const clients = {
  device: new RpcShellyClient(transport),
  inventory: new RpcShellyInventoryClient(transport),
  schedules: new RpcShellyScheduleClient(transport)
};
const saved = await checkPlugRegistration({
  baseUrl,
  name: 'Development plug',
  nowMs: Date.now(),
  clients
});
assert(saved.ok, JSON.stringify(saved));
const plug = saved.value;
assert.equal(
  plug.id,
  expectedDeviceId,
  'Physical device differs from the authorized test target.'
);
const initial = await readPlugRuntime(plug, [], clients);
assert(initial.ok, JSON.stringify(initial));
assert.equal(
  initial.value.inventory.scripts.length,
  0,
  'Start with no scripts; this smoke does not remove existing artifacts.'
);
assert.equal(
  initial.value.inventory.schedules.length,
  0,
  'Start with no schedules; this smoke does not remove existing artifacts.'
);
const storage = new Map<string, string>();
const registries = createDeviceRuleRegistries({
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => {
    storage.set(key, value);
  },
  removeItem: (key) => {
    storage.delete(key);
  }
});
assert(registries.plugs.getState().upsert(plug).ok);
assert.equal(registries.rules.getState().items.length, 0);
let testScriptId: number | null = null;
try {
  const on = await setUnownedPlugRelay({ plug, rules: [], on: true, clients });
  assert(on.ok && on.value.relayOn, JSON.stringify(on));
  process.stdout.write('PASS saved plug, zero rules: relay ON verified\n');
  const off = await setUnownedPlugRelay({ plug, rules: [], on: false, clients });
  assert(off.ok && !off.value.relayOn, JSON.stringify(off));
  process.stdout.write('PASS saved plug, zero rules: relay OFF verified\n');
  const code = generateShellyThermostatScript(createDefaultShellyThermostatConfig());
  const installed = await clients.device.installScript(createInstallPlan(code));
  assert(installed.ok, JSON.stringify(installed));
  testScriptId = installed.value.scriptId;
  const orphan = await readPlugRuntime(plug, [], clients);
  assert(orphan.ok, JSON.stringify(orphan));
  assert.deepEqual(
    orphan.value.managedScripts.map((script) => ({
      id: script.id,
      ruleIds: script.ruleIds
    })),
    [{ id: testScriptId, ruleIds: [] }]
  );
  const blocked = await setUnownedPlugRelay({ plug, rules: [], on: true, clients });
  assert(!blocked.ok && blocked.error.kind === 'relay-owned');
  const deleted = await deleteOrphanClimateScript({
    plug,
    rules: [],
    scriptId: testScriptId,
    clients
  });
  assert(deleted.ok, JSON.stringify(deleted));
  assert.equal(deleted.value.relayOn, false);
  assert.equal(deleted.value.managedScripts.length, 0);
  testScriptId = null;
  assert.equal(registries.plugs.getState().items.length, 1);
  process.stdout.write(
    'PASS exact orphan inventoried, control blocked, script removed; plug remains saved\n'
  );
} finally {
  if (testScriptId !== null) {
    const cleanup = await deleteOrphanClimateScript({
      plug,
      rules: [],
      scriptId: testScriptId,
      clients
    });
    if (!cleanup.ok)
      process.stderr.write(
        `Cleanup requires attention: ${JSON.stringify(cleanup.error)}\n`
      );
  }
  const off = await clients.device.setRelayOff({ relayId: 0 });
  const relay = await clients.inventory.readRelay();
  assert(
    off.ok && relay.ok && !relay.value.output,
    'Final relay OFF could not be verified.'
  );
  process.stdout.write('FINAL RELAY: OFF (Switch.GetStatus verified)\n');
}
