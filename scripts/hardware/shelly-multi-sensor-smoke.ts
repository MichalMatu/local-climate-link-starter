import { createHash } from 'node:crypto';
import {
  createDefaultShellyThermostatConfig,
  generateShellyThermostatScript,
  normalizeConfig
} from '@lcl/script-generator';
import {
  FetchShellyRpcTransport,
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  RPC_METHODS,
  RpcShellyClient,
  readShellyScriptCode,
  readShellyScriptList
} from '@lcl/shelly-client';

const baseUrl = process.env.SHELLY_URL ?? 'http://192.168.0.10';
const expectedDeviceId = process.env.SHELLY_DEVICE_ID ?? 'shellyplugsg3-e4b063d7f530';
const tempName = 'LCL Multi Sensor Smoke';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const must = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }, label: string): T => {
  if (!result.ok) throw new Error(`${label}: ${JSON.stringify(result.error)}`);
  return result.value;
};

const transport = new FetchShellyRpcTransport({ baseUrl, defaultTimeoutMs: 8000 });
const client = new RpcShellyClient(transport, { mutationDelayMs: 120 });
let tempId: number | null = null;

try {
  const device = must(await client.getDeviceInfo(), 'Shelly.GetDeviceInfo');
  if (device.id?.toLowerCase() !== expectedDeviceId.toLowerCase()) {
    throw new Error(`Unexpected Shelly identity: ${device.id ?? 'missing'}`);
  }

  const scriptsBefore = must(await readShellyScriptList(transport), 'Script.List before');
  const production = scriptsBefore.find((script) => script.name === LOCAL_CLIMATE_LINK_SCRIPT_NAME);
  if (!production) throw new Error('Managed production script was not found.');
  const productionCodeBefore = must(
    await readShellyScriptCode(transport, production.id),
    'production code before'
  );
  const productionShaBefore = sha256(productionCodeBefore);
  const schedulesBefore = must(
    await transport.call({ method: RPC_METHODS.ScheduleList }),
    'Schedule.List before'
  );
  const relayBefore = must(
    await transport.call({ method: RPC_METHODS.SwitchGetStatus, params: { id: 0 } }),
    'Switch.GetStatus before'
  );

  const staleTemp = scriptsBefore.find((script) => script.name === tempName);
  if (staleTemp) {
    if (staleTemp.running) must(await client.stopScript(staleTemp.id), 'stop stale temp');
    must(await client.deleteScript(staleTemp.id), 'delete stale temp');
  }

  const base = createDefaultShellyThermostatConfig('xiaomi_lywsd03mmc_bthome_v2', 'humidifying');
  const config = normalizeConfig({
    ...base,
    sensor: {
      ...base.sensor,
      sensorId: 'multi-smoke-a',
      runtimeAddress: 'AA:BB:CC:DD:EE:01',
      displayName: 'Smoke A'
    },
    sensorSet: {
      aggregation: 'avg',
      additionalSensors: [
        {
          ...base.sensor,
          profileId: 'tp357_custom_v1',
          sensorId: 'multi-smoke-b',
          runtimeAddress: '11:22:33:44:55:66',
          displayName: 'Smoke B'
        }
      ]
    },
    output: { ...base.output, relayId: 99 }
  });
  const code = generateShellyThermostatScript(config);

  const created = must(
    await transport.call<{ id: number }>({ method: RPC_METHODS.ScriptCreate, params: { name: tempName } }),
    'Script.Create'
  );
  tempId = created.id;
  for (let offset = 0; offset < code.length; offset += 1024) {
    must(
      await transport.call({
        method: RPC_METHODS.ScriptPutCode,
        params: { id: tempId, code: code.slice(offset, offset + 1024), append: offset > 0 }
      }),
      `Script.PutCode ${offset}`
    );
    await delay(120);
  }
  must(await client.startScript(tempId), 'Script.Start');
  await delay(800);
  const status = must(
    await transport.call<Record<string, unknown>>({
      method: RPC_METHODS.ScriptGetStatus,
      params: { id: tempId }
    }),
    'Script.GetStatus'
  );
  if (status.running !== true) throw new Error(`Temporary multi-sensor runtime is not running: ${JSON.stringify(status)}`);

  console.log(
    JSON.stringify(
      {
        device,
        generatedBytes: new TextEncoder().encode(code).length,
        status,
        productionShaBefore,
        schedulesBefore,
        relayBefore
      },
      null,
      2
    )
  );
} finally {
  if (tempId !== null) {
    try {
      await client.stopScript(tempId);
    } catch {}
    try {
      await client.deleteScript(tempId);
    } catch {}
  }

  const scriptsAfter = must(await readShellyScriptList(transport), 'Script.List after');
  const productionAfter = scriptsAfter.find((script) => script.name === LOCAL_CLIMATE_LINK_SCRIPT_NAME);
  if (!productionAfter) throw new Error('Managed production script disappeared during smoke.');
  try {
    await client.evaluateScript(productionAfter.id, 'bs();"ok"');
  } catch {}

  if (scriptsAfter.some((script) => script.name === tempName)) {
    throw new Error('Temporary multi-sensor script was not deleted.');
  }
  const productionCodeAfter = must(
    await readShellyScriptCode(transport, productionAfter.id),
    'production code after'
  );
  const schedulesAfter = must(
    await transport.call({ method: RPC_METHODS.ScheduleList }),
    'Schedule.List after'
  );
  const relayAfter = must(
    await transport.call({ method: RPC_METHODS.SwitchGetStatus, params: { id: 0 } }),
    'Switch.GetStatus after'
  );
  console.log(
    JSON.stringify(
      {
        cleanup: {
          productionRunning: productionAfter.running,
          productionShaAfter: sha256(productionCodeAfter),
          schedulesAfter,
          relayAfter
        }
      },
      null,
      2
    )
  );
}
