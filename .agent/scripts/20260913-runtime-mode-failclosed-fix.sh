#!/usr/bin/env bash
set -euo pipefail
BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='fbbde9abb37fe9fcdbce5c7cdc8f3bdd98e3d895'
git fetch --prune origin "$BRANCH" agent-control
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
test -z "$(git status --porcelain)"

python3 - <<'PY'
from pathlib import Path

p=Path('apps/mobile/src/flows/hardware-setup/shellyRequests.ts')
s=p.read_text()
s=s.replace("export type ShellyAutomationMode = 'auto' | 'manual' | 'stopped' | 'missing';", "export type ShellyAutomationMode =\n  | 'auto'\n  | 'manual'\n  | 'unknown'\n  | 'stopped'\n  | 'missing';")
old="""    automationMode: automationScript
      ? automationScript.running
        ? ((await readClimateMode(transport, automationScript.id)) ?? 'auto')
        : 'stopped'
      : 'missing',"""
new="""    automationMode: automationScript
      ? automationScript.running
        ? ((await readClimateMode(transport, automationScript.id)) ?? 'unknown')
        : 'stopped'
      : 'missing',"""
assert old in s
s=s.replace(old,new)
p.write_text(s)

p=Path('apps/mobile/src/flows/installations/runtimeModeTransport.ts')
s=p.read_text()
s=s.replace('  mode: ClimateRuntimeMode;\n  supported: boolean;', '  mode: ClimateRuntimeMode | null;\n  supported: boolean;')
s=s.replace("  return { mode: mode ?? 'auto', supported: mode !== null };", '  return { mode, supported: mode !== null };')
p.write_text(s)

p=Path('apps/mobile/src/flows/installations/runtimeStatus.ts')
s=p.read_text()
s=s.replace("export type InstalledAutomationControlMode = 'auto' | 'manual' | 'stopped' | 'missing';", "export type InstalledAutomationControlMode =\n  | 'auto'\n  | 'manual'\n  | 'unknown'\n  | 'stopped'\n  | 'missing';")
s=s.replace('    automationMode: runtime.mode,\n    runtimeModeSupported: runtime.supported', "    automationMode: runtime.mode ?? 'unknown',\n    runtimeModeSupported: runtime.supported")
p.write_text(s)

p=Path('apps/mobile/src/screens/AutomationDashboardScreen.tsx')
s=p.read_text()
old="""  const runtimeControllable =
    controlsVerified &&
    (controlStatus?.automationMode === 'auto' ||
      controlStatus?.automationMode === 'manual');
  const automationRunning = controlsVerified && controlStatus?.automationMode === 'auto';
  const manualControl = controlsVerified && controlStatus?.automationMode === 'manual';"""
new="""  const runtimeControllable =
    controlsVerified &&
    controlStatus?.runtimeModeSupported === true &&
    (controlStatus.automationMode === 'auto' || controlStatus.automationMode === 'manual');
  const automationRunning = runtimeControllable && controlStatus.automationMode === 'auto';
  const manualControl = runtimeControllable && controlStatus.automationMode === 'manual';"""
assert old in s
p.write_text(s.replace(old,new))

p=Path('apps/mobile/src/screens/InstallationDetailScreen.tsx')
s=p.read_text()
old="""  const isPaused = scriptMatch === 'matched' && control?.automationMode === 'manual';
  const canToggleAutomation =
    scriptMatch === 'matched' &&
    (control?.automationMode === 'auto' || control?.automationMode === 'manual');"""
new="""  const runtimeModeVerified = control?.runtimeModeSupported === true;
  const isPaused =
    scriptMatch === 'matched' && runtimeModeVerified && control.automationMode === 'manual';
  const canToggleAutomation =
    scriptMatch === 'matched' &&
    runtimeModeVerified &&
    (control.automationMode === 'auto' || control.automationMode === 'manual');"""
assert old in s
p.write_text(s.replace(old,new))

p=Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx')
s=p.read_text()
s=s.replace("  const manualControl = automationMode === 'manual';", "  const runtimeModeVerified = automationMode === 'auto' || automationMode === 'manual';\n  const manualControl = automationMode === 'manual';",1)
s=s.replace('              disabled={isControlBusy}\n              onClick={() => {\n                if (automationMode !== \'auto\') onAutomationAuto(device);', '              disabled={isControlBusy || !runtimeModeVerified}\n              onClick={() => {\n                if (automationMode !== \'auto\') onAutomationAuto(device);',1)
s=s.replace('              disabled={isControlBusy}\n              onClick={() => {\n                if (!manualControl) onAutomationManual(device);', '              disabled={isControlBusy || !runtimeModeVerified}\n              onClick={() => {\n                if (!manualControl) onAutomationManual(device);',1)
p.write_text(s)

p=Path('apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts')
s=p.read_text()
old="""      const currentStatus = await readShellyControlStatus(device.baseUrl);
      const scriptId = requireAutomationScript(currentStatus);
      const client = new RpcShellyClient(createShellyTransport(device.baseUrl));
      const transport = createShellyTransport(device.baseUrl);
      await writeClimateMode(transport, scriptId, 'manual');"""
new="""      const currentStatus = await readShellyControlStatus(device.baseUrl);
      const scriptId = requireAutomationScript(currentStatus);
      if (
        currentStatus.automationMode !== 'auto' &&
        currentStatus.automationMode !== 'manual'
      ) {
        throw new Error('MANUAL requires a verified live AUTO/MANUAL runtime.');
      }
      const client = new RpcShellyClient(createShellyTransport(device.baseUrl));
      const transport = createShellyTransport(device.baseUrl);
      await writeClimateMode(transport, scriptId, 'manual');"""
assert old in s
p.write_text(s.replace(old,new))

p=Path('apps/mobile/src/flows/installations/runtimeModeTransport.test.ts')
s=p.read_text()
s=s.replace("      mode: 'auto',\n      supported: false", "      mode: null,\n      supported: false")
p.write_text(s)

p=Path('apps/mobile/src/flows/installations/runtimeStatus.test.ts')
s=p.read_text()
s=s.replace("  automationMode: 'auto' | 'manual' | 'stopped' | 'missing',", "  automationMode: 'auto' | 'manual' | 'unknown' | 'stopped' | 'missing',")
s=s.replace("  it('recognises an old running runtime as AUTO but upgradeable', async () => {\n    mocks.readControlStatus.mockResolvedValue(baseStatus('auto', 7));\n    mocks.readRuntimeMode.mockResolvedValue({ mode: 'auto', supported: false });", "  it('keeps an unsupported running runtime explicitly unknown and upgradeable', async () => {\n    mocks.readControlStatus.mockResolvedValue(baseStatus('auto', 7));\n    mocks.readRuntimeMode.mockResolvedValue({ mode: null, supported: false });")
s=s.replace("    expect(status.automationMode).toBe('auto');\n    expect(status.runtimeModeSupported).toBe(false);", "    expect(status.automationMode).toBe('unknown');\n    expect(status.runtimeModeSupported).toBe(false);")
p.write_text(s)

p=Path('apps/mobile/src/flows/hardware-setup/bleDiscoveryMode.test.ts')
s=p.read_text()
needle="""  it('reads MANUAL from a running process and distinguishes a stopped process', async () => {
    const f = fixture(1);
    f.setScripts([climate]);
    expect((await readShellyControlStatus(endpoint)).automationMode).toBe('manual');
    f.setScripts([{ ...climate, running: false }]);
    expect((await readShellyControlStatus(endpoint)).automationMode).toBe('stopped');
  });"""
replacement="""  it('reads verified modes and keeps an unsupported running process explicitly unknown', async () => {
    const manualFixture = fixture(1);
    manualFixture.setScripts([climate]);
    expect((await readShellyControlStatus(endpoint)).automationMode).toBe('manual');

    vi.unstubAllGlobals();
    const unknownFixture = fixture(-1);
    unknownFixture.setScripts([climate]);
    expect((await readShellyControlStatus(endpoint)).automationMode).toBe('unknown');

    unknownFixture.setScripts([{ ...climate, running: false }]);
    expect((await readShellyControlStatus(endpoint)).automationMode).toBe('stopped');
  });"""
assert needle in s
p.write_text(s.replace(needle,replacement))
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/hardware-setup/shellyRequests.ts \
  apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts \
  apps/mobile/src/flows/hardware-setup/bleDiscoveryMode.test.ts \
  apps/mobile/src/flows/installations/runtimeModeTransport.ts \
  apps/mobile/src/flows/installations/runtimeModeTransport.test.ts \
  apps/mobile/src/flows/installations/runtimeStatus.ts \
  apps/mobile/src/flows/installations/runtimeStatus.test.ts \
  apps/mobile/src/screens/AutomationDashboardScreen.tsx \
  apps/mobile/src/screens/InstallationDetailScreen.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx

pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run \
  src/flows/hardware-setup/bleDiscoveryMode.test.ts \
  src/flows/installations/runtimeModeTransport.test.ts \
  src/flows/installations/runtimeStatus.test.ts \
  src/flows/installations/runtimeControl.test.ts \
  src/__tests__/automation-dashboard-controls.test.tsx \
  src/__tests__/automation-detail.test.tsx
pnpm quality:repo

git grep -n -E "\?\?[[:space:]]*['\"]auto['\"]|mode:[[:space:]]*mode[[:space:]]*\?\?" -- apps/mobile/src || true
git diff --check
git status --short
git diff --stat

git add \
  apps/mobile/src/flows/hardware-setup/shellyRequests.ts \
  apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts \
  apps/mobile/src/flows/hardware-setup/bleDiscoveryMode.test.ts \
  apps/mobile/src/flows/installations/runtimeModeTransport.ts \
  apps/mobile/src/flows/installations/runtimeModeTransport.test.ts \
  apps/mobile/src/flows/installations/runtimeStatus.ts \
  apps/mobile/src/flows/installations/runtimeStatus.test.ts \
  apps/mobile/src/screens/AutomationDashboardScreen.tsx \
  apps/mobile/src/screens/InstallationDetailScreen.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx

git commit -m 'Fail closed on unknown climate runtime mode'
printf 'FINAL_HEAD=%s\n' "$(git rev-parse HEAD)"
test -z "$(git status --porcelain)"
