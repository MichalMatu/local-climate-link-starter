import { readFile } from 'node:fs/promises';

const repoRoot = new URL('../../', import.meta.url);
const failures = [];
const read = (path) => readFile(new URL(path, repoRoot), 'utf8');
const requireMarkers = (path, source, markers) => {
  for (const marker of markers) {
    if (!source.includes(marker))
      failures.push(`${path}: missing lifecycle marker: ${marker}`);
  }
};

const installPlanPath = 'packages/shelly-client/src/scripts/install.ts';
const lifecyclePath = 'packages/shelly-client/src/scripts/installLifecycle.ts';
const deletePath = 'apps/mobile/src/flows/installations/runtimeControl.ts';
const architecturePath = 'docs/ARCHITECTURE.md';

const [installPlan, lifecycle, deletion, architecture] = await Promise.all([
  read(installPlanPath),
  read(lifecyclePath),
  read(deletePath),
  read(architecturePath)
]);

requireMarkers(installPlanPath, installPlan, [
  'replaceAllScripts: true',
  'relayId,',
  'backupExisting: false'
]);
requireMarkers(lifecyclePath, lifecycle, [
  'if (plan.replaceAllScripts)',
  'confirmRelayOffBeforeDestructiveReplacement(',
  'RPC_METHODS.ScriptStop',
  'RPC_METHODS.ScriptDelete',
  'verifiedList.value.length !== 1',
  'scriptHash: hashScriptCode(plan.code)'
]);
requireMarkers(deletePath, deletion, [
  'for (const script of setup.scripts)',
  'verified.scripts.length !== 0'
]);
requireMarkers(architecturePath, architecture, [
  'owns the full Shelly Scripts namespace',
  'script hashes describe generated code only'
]);

if (lifecycle.includes('hashScriptCode(`${plan.scriptName}:${plan.code}`)')) {
  failures.push(`${lifecyclePath}: script hash must remain code-only`);
}

if (failures.length > 0) {
  console.error('Exclusive script lifecycle gate failed:\n' + failures.join('\n'));
  process.exit(1);
}

console.log('Exclusive script lifecycle gate passed.');
