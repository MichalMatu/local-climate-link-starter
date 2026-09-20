# Next chat handoff — Slice 1B complete, Slice 2A next

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

## Last completed product slice — Slice 1B

Slice 1B is complete and integrated.

```text
product commit: 7aba04414abda1d0eb269e67599b574a4658404e
message: Reconcile installed automation when re-adding plug
validated work branch: work/slice1b-readd-reconcile
Local Agent final task: 20260920-slice1b-readd-reconcile-v6
```

Implemented contract:

- saved Plug identity is the normalized physical Shelly `deviceId` returned by `Shelly.GetDeviceInfo`;
- `baseUrl` is reachability only and no longer participates in automation ownership matching;
- dashboard/detail/scan matching uses stable physical identity;
- `features/automations` owns re-add reconciliation;
- the same physical Shelly can return at a new endpoint and refresh the durable automation endpoint without replacing ownership;
- climate runtime verification requires the expected managed script id, running state and exact code hash;
- Time runtime verification reuses exact schedule id/timespec/call matching;
- reconciliation distinguishes no local owner, verified runtime, changed runtime, unavailable verification and relay-owner conflict;
- unrelated scripts/schedules are never silently adopted.

The real regression is covered: an `InstalledAutomation` recorded at one endpoint is retained through Forget Plug, the same physical `deviceId` is added at another endpoint, the saved Plug and durable automation reconnect, and the automation remains visible rather than becoming an unconfigured Plug.

Verification:

- focused iterations covered reconciliation, hardware setup, dashboard/detail and routing regressions;
- final mobile typecheck passed;
- final full `pnpm check` passed on the accepted v6 implementation;
- postimplementation diff audit passed with no architecture-baseline change;
- no physical Shelly smoke was required for this identity/re-association slice.

Known limitation: complete reconstruction after Local Climate Link storage loss remains out of scope. Do not heuristically adopt device runtime without durable ownership evidence.

The completed branch must not be resumed for new product work. Start Slice 2A from fresh `main` after branch cleanup.

## Immediate next slice — Slice 2A

**Edit an installed climate automation in place instead of forcing delete/reinstall.**

Required product flow:

```text
Plug
-> installed climate automation
-> Edit
-> existing InstalledAutomation config pre-fills the editor
-> Save
-> mutate/replace only the managed Shelly runtime owned by that automation
-> verify resulting runtime
-> persist the updated InstalledAutomation
```

Preimplementation ownership expectations:

- `features/automations` owns edit orchestration and durable installed-automation updates;
- reuse the existing climate editor/config model rather than creating an edit-only form;
- `@lcl/shelly-client` remains the protocol/runtime mutation owner;
- screens/routes only enter the edit flow and render feature-owned state;
- preserve `installedAtMs`; advance `updatedAtMs` only after verified remote success;
- preserve automation identity when relay ownership does not change;
- verify stable Shelly identity and relay/sensor ownership before destructive runtime changes;
- failed remote mutation must not leave durable local state claiming the new config is installed;
- do not introduce BLE-specific implementation into this slice, but keep all new Shelly calls transport-neutral through existing client/transport boundaries.

Acceptance must include editing at least thresholds/preset/sensor-relevant climate config through the existing editor pipeline, successful runtime verification, local durable-state update after success, and failure/conflict coverage proving local state does not lie.

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
