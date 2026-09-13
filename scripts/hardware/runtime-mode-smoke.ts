import assert from 'node:assert/strict';
import {
  createDefaultShellyThermostatConfig,
  generateShellyThermostatScript,
  generateShellyBleDiscoveryScript
} from '@lcl/script-generator';
import {
  createInstallPlan,
  FetchShellyRpcTransport,
  RpcShellyClient,
  RpcShellyInventoryClient,
  RpcShellyScheduleClient
} from '@lcl/shelly-client';
import {
  prepareShellyBleDiscovery,
  stopShellyBleDiscovery,
  installShellyBleDiscoveryScript,
  readShellyBleDiscoverySnapshot
} from '../../apps/mobile/src/flows/hardware-setup/shellyRequests.js';
import {
  readClimateMode,
  writeClimateMode
} from '../../apps/mobile/src/flows/runtime/modeProtocol.js';
const baseUrl = process.env.SHELLY_URL;
const expectedDeviceId = process.env.SHELLY_DEVICE_ID;
assert(baseUrl && expectedDeviceId, 'Set SHELLY_URL and SHELLY_DEVICE_ID.');
const transport = new FetchShellyRpcTransport({ baseUrl });
const client = new RpcShellyClient(transport);
const info = await client.getDeviceInfo();
assert(info.ok && info.value.id === expectedDeviceId);
const inventory = new RpcShellyInventoryClient(transport);
const scripts = await inventory.listScripts();
const schedules = await new RpcShellyScheduleClient(transport).list();
assert(scripts.ok && scripts.value.scripts.length === 0, 'Start with no scripts.');
assert(schedules.ok && schedules.value.jobs.length === 0, 'Start with no schedules.');
const installed = await client.installScript(
  createInstallPlan(generateShellyThermostatScript(createDefaultShellyThermostatConfig()))
);
assert(installed.ok, JSON.stringify(installed));
const id = installed.value.scriptId;
let discoveryId: number | null = null;
try {
  for (const mode of ['manual', 'auto'] as const) {
    await writeClimateMode(transport, id, mode);
    const before = await prepareShellyBleDiscovery(baseUrl);
    assert.equal(before.automationMode, mode);
    assert.equal(await readClimateMode(transport, id), 'manual');
    const discovery = await installShellyBleDiscoveryScript(
      baseUrl,
      generateShellyBleDiscoveryScript()
    );
    discoveryId = discovery.scriptId;
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const scan = await readShellyBleDiscoverySnapshot(baseUrl, discoveryId);
    assert.equal(scan.running, true);
    await stopShellyBleDiscovery(baseUrl, { discoveryScriptId: discoveryId, ...before });
    discoveryId = null;
    assert.equal(await readClimateMode(transport, id), mode);
    process.stdout.write(
      `PASS ${mode.toUpperCase()} -> discovery (running) -> ${mode.toUpperCase()}, climate process preserved\n`
    );
  }
} finally {
  const current = await client.getDeviceInfo();
  assert(
    current.ok && current.value.id === expectedDeviceId,
    'Physical identity changed.'
  );
  if (discoveryId !== null) {
    await client.stopScript(discoveryId);
    await client.deleteScript(discoveryId);
  }
  await client.stopScript(id);
  await client.deleteScript(id);
  const off = await client.setRelayOff();
  const status = await inventory.readRelay();
  assert(off.ok && status.ok && !status.value.output);
  process.stdout.write('FINAL RELAY: OFF verified\n');
}
