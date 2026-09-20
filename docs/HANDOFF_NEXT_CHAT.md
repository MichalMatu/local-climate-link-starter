# Next chat handoff — Slice 1A complete, Slice 1B next

Updated: 2026-09-20

This is the canonical continuation state for `MichalMatu/local-climate-link-starter`.

## Start here

Before any write, read in this order:

```text
AGENTS.md
nearest nested AGENTS.md for the touched area
docs/HANDOFF_NEXT_CHAT.md
docs/implementation/automation-recovery-editing-shelly-transport-plan.md
docs/architecture/overview.md
docs/architecture/refactor-boundaries.md
docs/architecture/feature-boundaries.md
fresh main
agent-control:.agent/status/daemon.json
```

Repository/runtime identity:

```text
repository: MichalMatu/local-climate-link-starter
default/product branch: main
control branch: agent-control
Local Agent binding: e75c77cb-7589-4452-94b2-decc97ff85a1
managed workspace: /Users/michal/agent-workspace/repos/local-climate-link-starter/work
```

Always fetch fresh `main`. Do not resume a historical work branch unless this handoff explicitly says to do so.

## Product invariants

```text
physical Plug -> optional installed automation
bottom navigation: Plugs | Thermometers | Settings
phone: configure/manage/diagnose
Shelly: execute installed automation locally
```

Keep these invariants:

- a saved Plug remains useful without automation;
- `InstalledAutomation` is durable managed-automation ownership;
- one Plug relay has one managed automation owner at a time;
- Forget Plug is local-only and is not Uninstall Automation;
- explicit uninstall preserves managed-identity verification and safe OFF;
- stable Shelly `deviceId` is physical identity;
- IP / `baseUrl` is reachability only and must not become the ownership key;
- future BLE remains another transport under the same Shelly client/product behavior.

## Slice lifecycle

```text
fresh main + idle daemon
-> preimplementation ownership/identity/transport audit
-> smallest cohesive implementation
-> focused tests
-> quality:repo when boundaries are touched
-> exactly one final full pnpm check
-> hardware/native smoke only when acceptance requires it
-> postimplementation full-diff re-audit
-> update canonical docs + plan + handoff
-> commit/push
-> review pushed diff
-> fast-forward main
-> verify main
```

Do not raise architecture baselines to make a slice fit. New cohesive product modules belong under `apps/mobile/src/features/<feature>`; protocol/domain behavior stays in packages; screens do not own transport or persistence.

## Baseline repair completed before Slice 1A

A fresh GitHub CI checkout exposed a stale dependency ownership problem: root `package.json` no longer owned `@vitest/coverage-v8`, while core package coverage scripts still required it. This was fixed before Slice 1A.

```text
commit: 13168d29a21c1c85e2690399bff10a3c0875ade9
message: Fix workspace coverage dependencies
```

`@vitest/coverage-v8` now belongs to the two packages that actually run `vitest --coverage`: `@lcl/automation-core` and `@lcl/script-generator`. A frozen install and full `pnpm check` passed.

## Last completed product slice — Slice 1A

Slice 1A is complete and integrated.

```text
product commit: b0b80e37fde234f2c0e1cbe8375d9235e5d91379
message: Protect automation ownership when forgetting plug
validated work branch: work/slice1a-forget-preserves-automation
Local Agent task: 20260920-slice1a-forget-preserves-automation-v1
```

Audit result:

- `setupDraftStore.removeShellyDevice` only removes the saved Plug entry/selection;
- `useHardwareSetupFlow.removeShellyDevice` additionally clears transient control/setup/install state only;
- `usePlugManagementSurface` delegates the confirmed local removal;
- production `removeInstallation` calls remain in explicit climate/Time uninstall detail flows;
- Forget Plug therefore did not need a production code change.

Verification:

- focused `hardware-setup.test.tsx` passed;
- `pnpm quality:repo` passed;
- exactly one final full `pnpm check` passed;
- postimplementation diff audit passed;
- no physical Shelly smoke was required.

The regression test now creates a durable `InstalledAutomation`, forgets the saved Plug through the real UI confirmation path, and proves the automation ownership record remains unchanged.

The completed branch should not be resumed for new product work. Start Slice 1B from fresh `main`.

## Immediate next slice — Slice 1B

**Re-add the same physical Shelly and reconcile its existing managed automation.**

The preimplementation audit has already located the primary identity bug:

```text
useShellyControlFlow.checkShellyMutation
  -> reads Shelly.GetDeviceInfo and receives stable deviceInfo.id
  -> currently discards that id
  -> saves ShellyDraftDevice.id = baseUrl

AutomationDashboardScreen / InstallationDetailScreen
  -> currently associate saved Plug and InstalledAutomation by baseUrl
```

That is the wrong boundary. Slice 1B must make stable device identity authoritative without turning IP into an ownership key.

Required behavior:

```text
existing local InstalledAutomation(deviceId=A, old baseUrl=X)
-> Forget Plug
-> same physical Shelly A is discovered/added at baseUrl=Y
-> verified deviceId A reconnects the saved Plug to existing ownership
-> last-known endpoint becomes Y independently of ownership
-> managed climate script / Time schedule is verified remotely
-> existing automation is shown, not replaced or silently adopted
```

Reconciliation must distinguish at least:

```text
no local managed record
local record + verified managed runtime
local record + remote runtime missing/changed
remote verification unavailable
local relay ownership conflict
```

Known reusable owners:

- `features/automations` owns durable `InstalledAutomation` state and should own automation reconciliation logic;
- `readShellyAutomationScriptState` / exact managed-script reads can verify climate runtime without heuristic adoption;
- `readTimeAutomationRuntime` + schedule pair matching already verifies exact Time schedule ids/calls;
- the saved Plug check/add flow already owns physical Shelly verification and receives `deviceInfo.id`;
- dashboard/detail must associate by stable identity, not normalized URL.

Do not create a broad device-registry rewrite unless the touched slice proves it is required. Do not add baseUrl fallback ownership matching.

## What follows

```text
2A  edit installed climate automation in place
2B  edit installed Time automation in place
3A  device-settings foundation + complete LED settings
3B+ additional Shelly settings families
4A  real-hardware BLE feasibility/protocol spike
4B  BLE ShellyRpcTransport
4C+ incremental BLE-backed capabilities
```

Detailed acceptance criteria live in `docs/implementation/automation-recovery-editing-shelly-transport-plan.md`.

## Canonical docs

```text
AGENTS.md
apps/mobile/AGENTS.md
apps/mobile/src/features/AGENTS.md
packages/AGENTS.md
packages/ui/AGENTS.md
scripts/quality/AGENTS.md
docs/HANDOFF_NEXT_CHAT.md
docs/implementation/automation-recovery-editing-shelly-transport-plan.md
docs/architecture/overview.md
docs/architecture/refactor-boundaries.md
docs/architecture/feature-boundaries.md
scripts/quality/architecture-baseline.mjs
```

Historical plans are reference only. Current code + canonical docs + the active execution plan win on conflict.
