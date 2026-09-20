# Next chat handoff — Slice 2B complete, Slice 3A next

Updated: 2026-09-21

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
-> cleanup completed work branch
```

Do not raise architecture baselines to make a slice fit. New cohesive product modules belong under `apps/mobile/src/features/<feature>`; protocol/domain behavior stays in packages; screens do not own raw transport or persistence.

## Last completed product slice — Slice 2B

Slice 2B is complete and integrated.

```text
product commit: e1a4c63e32000a90c22bd02b6c01ae9b37bff536
message: Edit installed Time automation in place
validated work branch: work/slice2b-edit-time
Local Agent focused task: 20260921-slice2b-edit-time-v2
Local Agent final task: 20260921-slice2b-edit-time-v3-final
```

Implemented contract:

- installed Time automation detail exposes Edit;
- existing Time schedule setup UI is reused and prefilled from durable ON/OFF config;
- `features/automations/flows/updateTimeInstalledAutomation.ts` verifies live physical Shelly identity and product ownership before allowing remote mutation;
- relay ownership conflict and a managed climate script are rejected before the Time edit runtime runs;
- `updateDailyTimeAutomation` remains the only native Shelly schedule mutation path;
- it verifies the exact stored schedule pair, forces a safe relay state, updates the same job IDs, preserves paused versus running state, verifies the resulting runtime and performs rollback on failure;
- durable automation id, `onJobId`, `offJobId` and `installedAtMs` remain stable;
- edited config and `updatedAtMs` are committed locally only after verified runtime success;
- `TimeInstallationDetail` no longer owns edit mutation/persistence; it owns management/status/pause/resume/delete presentation;
- climate and Time share Edit routing only, not runtime implementation;
- the Time edit route remains under the Plug dashboard context (`kind: climate` in the current internal navigation naming), because Time automation is still attached to a Plug.

Verification:

- focused validation: 6 files / 94 tests passed;
- `pnpm quality:repo`, feature-boundary gate and gate self-test passed;
- exactly one accepted final full `pnpm check` passed in `20260921-slice2b-edit-time-v3-final`;
- final gate covered format, lint, UX/repository gates, all workspace typechecks/tests, core coverage and production builds;
- postimplementation audit found no baseline/dependency/lockfile changes;
- final branch was squashed to one commit and reviewed as a clean one-commit fast-forward;
- no physical-device smoke was required because native schedule update/rollback behavior is deterministically covered at the Time runtime and Shelly schedule-client boundaries.

Failure semantics carried forward: if remote mutation fails, the durable record remains on the previous config. The runtime attempts to restore both old schedule definitions and safe relay state. If that remote rollback itself cannot be completed, runtime health/reconciliation must surface the mismatch instead of pretending the edit succeeded.

## Immediate next slice — Slice 3A

**Build the device-settings foundation and complete LED settings for the supported Shelly Plug family.**

Do not start by copying or expanding the current UI blindly. First inventory actual supported hardware/protocol capabilities and the partial implementation already present.

Read/audit first:

```text
packages/AGENTS.md
apps/mobile/src/features/AGENTS.md
packages/shelly-client/src/plugsUi.ts
packages/shelly-client/src/model.ts
apps/mobile/src/flows/installations/deviceLed.ts
apps/mobile/src/screens/ShellyLedSettingsCard.tsx
apps/mobile/src/screens/hardware-setup/pages/ShellySettingsContent.tsx
apps/mobile/src/screens/PlugSettingsScreen.tsx
relevant LED/settings tests
current official Shelly RPC / Plug UI documentation for the target device family
```

Preimplementation ownership target:

```text
features/plugs settings UI/flow
        -> @lcl/shelly-client typed LED settings/capabilities API
        -> ShellyRpcTransport
```

3A requirements:

- confirm the real target device family and actual `PLUGS_UI.GetConfig` / `PLUGS_UI.SetConfig` shape from current official documentation and physical hardware;
- inventory what the existing LCL code already supports versus what the device exposes;
- feature code receives typed LED settings/capabilities, never raw RPC JSON;
- protocol parsing/validation and Shelly-specific config shapes live in `@lcl/shelly-client`;
- partial writes preserve unrelated/unknown config fields;
- unsupported options are capability-driven, not scattered model-name checks;
- no generic `ShellySettingsManager`, raw JSON editor or God object;
- HTTP remains just the current transport implementation under the existing client boundary; do not add speculative BLE behavior in 3A;
- complete the LED family before moving to another Shelly settings family;
- physical Shelly verification is required before 3A can be marked done.

## What follows

```text
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
