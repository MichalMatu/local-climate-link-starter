import { pathToFileURL } from 'node:url';

const moduleUrl = pathToFileURL(
  `${process.cwd()}/packages/shelly-client/dist/index.js`
).href;
const { FetchShellyRpcTransport, RpcShellyClient, RPC_METHODS, LOCAL_CLIMATE_LINK_SCRIPT_NAME } = await import(moduleUrl);

const baseUrl = 'http://192.168.0.16';
const transport = new FetchShellyRpcTransport({ baseUrl, defaultTimeoutMs: 5000 });
const client = new RpcShellyClient(transport);

const unwrap = (result, label) => {
  if (!result.ok) {
    throw new Error(`${label}: ${result.error.technicalMessage ?? result.error.kind}`);
  }
  return result.value;
};

const list = unwrap(
  await transport.call({ method: RPC_METHODS.ScriptList }),
  'Script.List'
);
const managed = (list.scripts ?? []).filter(
  (script) => script.name === LOCAL_CLIMATE_LINK_SCRIPT_NAME
);
if (managed.length !== 1) {
  throw new Error(`Expected exactly one managed script, got ${managed.length}`);
}
const scriptId = managed[0].id;
console.log(`MANAGED_SCRIPT_ID=${scriptId}`);
console.log(`INITIAL_SCRIPT_RUNNING=${Boolean(managed[0].running)}`);

try {
  unwrap(await client.startScript(scriptId), 'Script.Start');
  await new Promise((resolve) => setTimeout(resolve, 300));
  unwrap(await client.setRelayOff(), 'pre-test relay OFF');

  const before = unwrap(
    await transport.call({ method: RPC_METHODS.SwitchGetStatus, params: { id: 0 } }),
    'pre-test Switch.GetStatus'
  );
  console.log(`PRE_TEST_RELAY_ON=${Boolean(before.output)}`);
  if (before.output) {
    throw new Error('Relay was not OFF before safeRelayTest');
  }

  const startedAt = Date.now();
  const result = await client.safeRelayTest();
  const elapsedMs = Date.now() - startedAt;
  const relayTest = unwrap(result, 'safeRelayTest');
  console.log(`SAFE_RELAY_TEST_ELAPSED_MS=${elapsedMs}`);
  console.log(`ON_COMMAND_SENT=${relayTest.onCommandSent}`);
  console.log(`OFF_COMMAND_SENT=${relayTest.offCommandSent}`);
  console.log(`RESULT_FINAL_RELAY_ON=${relayTest.finalRelayOn}`);

  if (!relayTest.onCommandSent || !relayTest.offCommandSent || relayTest.finalRelayOn) {
    throw new Error('safeRelayTest result contract failed');
  }
  if (elapsedMs < 500) {
    throw new Error(`safeRelayTest pulse was too short: ${elapsedMs} ms`);
  }

  const after = unwrap(
    await transport.call({ method: RPC_METHODS.SwitchGetStatus, params: { id: 0 } }),
    'post-test Switch.GetStatus'
  );
  const scriptStatus = unwrap(
    await transport.call({ method: RPC_METHODS.ScriptGetStatus, params: { id: scriptId } }),
    'post-test Script.GetStatus'
  );
  console.log(`POST_TEST_RELAY_ON=${Boolean(after.output)}`);
  console.log(`POST_TEST_SCRIPT_RUNNING=${Boolean(scriptStatus.running)}`);
  if (after.output || scriptStatus.running !== true) {
    throw new Error('Post-test state did not preserve running automation with relay OFF');
  }
} finally {
  unwrap(await client.setRelayOff(), 'final relay OFF');
  const finalStatus = unwrap(
    await transport.call({ method: RPC_METHODS.SwitchGetStatus, params: { id: 0 } }),
    'final Switch.GetStatus'
  );
  const finalScriptStatus = unwrap(
    await transport.call({ method: RPC_METHODS.ScriptGetStatus, params: { id: scriptId } }),
    'final Script.GetStatus'
  );
  console.log(`FINAL_RELAY_ON=${Boolean(finalStatus.output)}`);
  console.log(`FINAL_SCRIPT_RUNNING=${Boolean(finalScriptStatus.running)}`);
  if (finalStatus.output) {
    throw new Error('Final relay state is ON');
  }
}
