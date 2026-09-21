# Next chat handoff — Slice 3A integrated, CI repair complete, Slice 3B active

Updated: 2026-09-21

This is the canonical continuation state for `MichalMatu/local-climate-link-starter`.

## Immediate state — read before doing anything

Slice 3A is complete. The post-3A BLE-discovery teardown race is repaired, its lifecycle regression coverage is integrated, the responsive smoke suite is aligned with the current Plug-owned navigation, and `main` is green again.

```text
main before this docs-only handoff update: c635ed59a6c96965fd9da64b7bb0d65ba41064fe
main message: Refresh responsive smoke for Plug-owned navigation
green CI run: 35550780412
green CI job: 106185001916
Responsive smoke: success
repair branch: work/fix-ble-discovery-unmount-race (cleanup only; do not resume product work there)
```

The repaired race was a pending Shelly BLE discovery mutation settling after unmount and attempting React state updates after teardown. `useShellyBleDiscoveryFlow` now guards React state ownership with `mountedRef` while still allowing remote/ref cleanup to finish. Focused lifecycle regression coverage proves late reject and late success cleanup behavior.

The separate responsive failure was stale E2E navigation coverage after the product moved to Plug-owned automation flows. Commit `c635ed59a6c96965fd9da64b7bb0d65ba41064fe` changes only `apps/mobile/e2e/responsive.spec.ts` and the full GitHub CI run above passed through responsive smoke.

## Active product goal — Slice 3B

Start **Slice 3B: physical button input mode** for Plug S Gen3.

Target capability:

```text
PLUGS_UI.controls["switch:0"].in_mode

momentary | detached
```

Current real Plug S Gen3 reported `momentary` during the Slice 3A hardware read.

Semantics:

- `momentary` — physical button controls the relay;
- `detached` — physical button is decoupled from relay control.

Keep this a separate settings family from LED settings.

```text
features/plugs focused button-mode settings UI/flow
        -> @lcl/shelly-client typed PLUGS_UI controls API
        -> ShellyRpcTransport
```

Do not expand the LED editor into a generic settings manager. Reuse stable `deviceId` verification. Write only the narrow `controls.switch:0.in_mode` patch and preserve unrelated LED and controls configuration.

Before marking Slice 3B complete, confirm the exact behavior against current official Shelly documentation and real hardware at `http://192.168.0.10/`.

BLE transport remains deferred to Slice 4A+.

## Exact next work

1. Delete the completed repair branch `work/fix-ble-discovery-unmount-race` after verifying it is fully contained in `main`.
2. Fetch fresh `main` and verify the Local Agent daemon is idle and bound to this repository.
3. Read:
   - `AGENTS.md`
   - `apps/mobile/AGENTS.md`
   - `apps/mobile/src/features/AGENTS.md`
   - `packages/AGENTS.md`
   - nearest nested AGENTS for touched files
   - this handoff
   - `docs/implementation/automation-recovery-editing-shelly-transport-plan.md`
   - `docs/architecture/overview.md`
   - `docs/architecture/refactor-boundaries.md`
   - `docs/architecture/feature-boundaries.md`
4. Perform the preimplementation ownership/identity/transport audit before implementation.
5. Inspect the existing typed `PLUGS_UI` LED client path and the current `features/plugs` LED settings flow as the nearest architectural precedent, without merging the two settings families.
6. Confirm the official Shelly `PLUGS_UI.controls["switch:0"].in_mode` contract and current Plug S Gen3 support.
7. Implement the smallest cohesive 3B slice with focused package + mobile tests.
8. Run focused checks while iterating; run `pnpm quality:repo` if boundaries are touched.
9. Run exactly one accepted final full `pnpm check` for the final 3B diff.
10. Run real-hardware validation when the code path is ready. Preserve the original mode after reversible testing unless the user explicitly wants a persistent change.
11. Postimplementation re-audit the full diff, update canonical docs/plan/handoff, commit/push, review the pushed diff, fast-forward `main`, verify GitHub CI, then delete the completed 3B branch.

## Preimplementation ownership contract for 3B

The audit must confirm or refine these expected owners before code is written:

```text
product owner      -> apps/mobile/src/features/plugs
state owner        -> focused button-mode feature flow/local UI state; no new global store unless proven necessary
side-effect owner  -> @lcl/shelly-client typed PLUGS_UI RPC + existing neutral Shelly transport boundary
UI owner           -> focused Plug button-mode settings component/page under features/plugs
durable state      -> none unless current product behavior proves a need; device setting lives on Shelly
test owner         -> shelly-client request/response tests + plugs feature tests + app navigation/composition coverage where needed
```

Hard constraints:

- screens/components do not call raw RPC/fetch;
- `packages/*` never import from `apps/*`;
- do not put this responsibility into `HardwareSetupScreen` or `useHardwareSetupFlow`;
- do not enlarge the LED settings flow into a catch-all device settings manager;
- stable Shelly `deviceId` is identity; IP/base URL is reachability only;
- every read/write that can mutate device state must verify live device identity first;
- write the narrowest controls patch and preserve unrelated `PLUGS_UI` data;
- no new production dependency;
- do not raise architecture baselines to make the slice fit.

## Local Chat Bridge identity

```text
repository id: local-climate-link-starter
repository: MichalMatu/local-climate-link-starter
agent_binding: e75c77cb-7589-4452-94b2-decc97ff85a1
execution_enabled: true
control branch: agent-control
managed workspace: /Users/michal/agent-workspace/repos/local-climate-link-starter/work
```

Every Local Agent task for this repository must contain exactly:

```json
"agent_binding": "e75c77cb-7589-4452-94b2-decc97ff85a1"
```

Autonomous continuation rules:

- inspect fresh bound-repo daemon/run/result evidence before queueing Local Agent work;
- never queue a duplicate task for the same active goal;
- use direct GitHub edits when the diff is deterministic and reviewable;
- use Local Agent for local commands/builds/tests/native/hardware access;
- never launch another coding agent through Local Agent;
- if hardware/credentials/user approval/another repository is required and unavailable, pause instead of guessing.

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

## Completed Slice 3A

```text
product commit: b0319dddd668c6474b7544c38018518027e3b5f1
message: Complete Plug S LED settings
3A handoff/integration checkpoint: f4c615c0dd8f9c7f9cca064b301119f829ece851
post-repair responsive commit: c635ed59a6c96965fd9da64b7bb0d65ba41064fe
accepted final full check: 20260921-slice3a-final-check-v2
real hardware smoke: 20260921-slice3a-hardware-smoke-v1
live typed-client read: 20260921-slice3a-live-client-read-v1
focused responsive LED E2E: 20260921-slice3a-real-night-window-e2e-v2
post-repair green CI: 35550780412 / 106185001916
```

Implemented 3A contract:

- `@lcl/shelly-client` owns typed `PLUGS_UI` LED protocol for Plug S Gen3: `power | switch | off`, relay ON/OFF RGB + brightness, power brightness and night mode;
- `features/plugs` owns LED settings orchestration/presentation for a physical Plug, with or without installed climate/Time automation;
- every LED read/write verifies live `Shelly.GetDeviceInfo.id` against stable saved `deviceId`; `baseUrl` is reachability only;
- writes are deep partial LED-only patches and never write unrelated `controls`;
- unsupported options are capability-driven;
- current HTTP remains an adapter under the Shelly client boundary; no speculative BLE transport was added.

Real Plug S Gen3:

```text
URL: http://192.168.0.10/
deviceId: shellyplugsg3-e4b063d7f530
model: S3PL-00112EU
gen: 3
firmware: 1.7.5
fw_id: 20260311-095902/1.7.5-g9979d16
```

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
-> verify main including CI
-> cleanup completed work branch
```

## What follows

```text
3B  physical button input mode     ACTIVE
3C+ additional settings families
4A  real-hardware BLE feasibility/protocol spike
4B  BLE ShellyRpcTransport
4C+ incremental BLE-backed capabilities
```

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
