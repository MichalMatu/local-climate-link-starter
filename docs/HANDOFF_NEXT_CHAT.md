# Next chat handoff — Slice 2A complete, Slice 2B next

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

Do not raise architecture baselines to make a slice fit. New cohesive product modules belong under `apps/mobile/src/features/<feature>`; protocol/domain behavior stays in packages; screens do not own transport or persistence.

## Last completed product slice — Slice 2A

Slice 2A is complete and integrated.

```text
product commit: 05f7eb4b8c83c1583222f374c8f3ebabff7e7703
message: Edit installed climate automation in place
validated work branch: work/slice2a-edit-climate
Local Agent final task: 20260921-slice2a-edit-climate-v20-final
plan-finalization commit: 62b649ba64cedc58f493f965c28aa47436559d9f
work branch disposition: deleted from origin by 20260921-slice2a-z-cleanup-v2
```

Implemented contract:

- climate installation detail exposes Edit;
- the existing climate editor is hydrated from durable `InstalledAutomation` config rather than introducing a second edit-only form;
- `features/automations` owns edit-draft derivation and remote edit orchestration;
- stable Shelly `deviceId` is verified before mutation;
- relay ownership and conflicting native Shelly schedules are checked before mutation;
- the remote managed script must still match the durable script id/hash before replacement;
- relay OFF is explicitly requested and confirmed before replacement and again after replacement;
- replacement must preserve the managed script id;
- final runtime verification requires the expected script id, running state and exact generated-code hash;
- durable automation identity and `installedAtMs` remain stable;
- `updatedAtMs` and edited config are persisted only after verified remote success;
- failure/conflict paths do not persist the edited config as installed;
- route/detail/hardware-setup composition returns the user to the same installed automation after a successful edit;
- hardware setup tab/hash routing was extracted instead of increasing hotspot budgets.

Verification:

- focused edit/runtime/route/detail/hardware-setup iterations passed, including 84/84 focused tests and a final 56/56 hardware-setup regression run;
- `pnpm quality:repo` passed without architecture-baseline changes;
- accepted final full `pnpm check` passed in `20260921-slice2a-edit-climate-v20-final`, including formatting, lint, UX/repository gates, typecheck, tests, core coverage and production builds;
- pushed diff was reviewed after validation and was a clean one-commit fast-forward onto `main`;
- no physical Shelly smoke was required for this slice because mutation/verification behavior is covered by deterministic service fixtures and existing Shelly client lifecycle tests.

Transport note: climate edit currently reaches Shelly through the existing `platform/shellyHttpTransport` adapter and `@lcl/shelly-client` RPC APIs. Product UI does not call raw HTTP. Do not invent BLE selection in Slice 2B; generic transport selection belongs to the later real-hardware BLE work.

Known limitation carried forward: if a remote script upload fails after the existing script has begun to mutate, durable state intentionally does not claim the new config; runtime health/reconciliation must expose the resulting mismatch. Do not hide such a state by overwriting local ownership evidence.

## Immediate next slice — Slice 2B

**Edit an installed Time automation in place while keeping Shelly native schedules as the runtime owner.**

Existing runtime foundation already provides `updateDailyTimeAutomation` under `features/automations/data/timeAutomationRuntime.ts`; do not build a parallel schedule mutation path before auditing and reusing it.

Required product flow:

```text
Plug
-> installed Time automation
-> Edit
-> existing Time config pre-fills the schedule editor
-> Save
-> verify exact currently-owned schedule pair
-> update the same managed native schedule pair safely
-> verify resulting schedule pair/runtime
-> persist updated InstalledAutomation
-> return to the same automation detail
```

Preimplementation architecture gate for 2B:

```text
product owner      -> features/automations
state owner        -> InstalledAutomation feature state/repository
side-effect owner  -> existing Time runtime + @lcl/shelly-client schedule clients
UI owner           -> existing Time setup/editor/detail composition
route owner        -> app routes only for edit navigation context
```

Audit before coding:

- `apps/mobile/src/features/automations/data/timeAutomationRuntime.ts` and tests;
- `timeAutomationRuntimeState.ts`, `timeAutomationSchedule.ts`, `timeAutomationClients.ts`;
- `apps/mobile/src/flows/time-automation/useTimeAutomationSetupFlow.ts`;
- `apps/mobile/src/screens/TimeInstallationDetail.tsx`;
- `apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx`;
- `packages/shelly-client` schedule API and validators;
- app route/detail tests that should prove edit entry/return.

2B invariants:

- do not route Time through the climate script runtime or climate editor;
- verify the exact stored `onJobId` / `offJobId` schedule pair before mutation;
- preserve schedule job IDs when the current runtime API can update them safely;
- preserve automation id and `installedAtMs`;
- update `updatedAtMs`, config and schedule metadata only after verified remote success;
- preserve running versus paused state across edit;
- enforce safe relay behavior throughout mutation and rollback;
- reject another managed automation/native schedule taking the relay;
- if mutation fails, do not claim the edited config as installed; preserve enough evidence for runtime health to show attention if rollback is incomplete;
- do not create a generic climate/Time edit manager merely because both have an Edit button.

## What follows

```text
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
