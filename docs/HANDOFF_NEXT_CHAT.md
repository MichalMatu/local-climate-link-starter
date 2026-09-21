# Next chat handoff — Slice 3A integrated, CI repair active, 3B blocked

Updated: 2026-09-21

This is the canonical continuation state for `MichalMatu/local-climate-link-starter`.

## Immediate state — read before doing anything

`Slice 3A` is implemented, hardware-verified, documented and integrated on `main`, but the first clean Linux CI run after integration exposed an unrelated pre-existing/latent BLE-discovery teardown race. Do **not** start Slice 3B until this CI repair is complete and `main` is green again.

```text
main: f4c615c0dd8f9c7f9cca064b301119f829ece851
main message: Finalize Slice 3A handoff
Slice 3A product commit: b0319dddd668c6474b7544c38018518027e3b5f1
active repair branch: work/fix-ble-discovery-unmount-race
active repair head before this handoff-doc commit: 57f0b97788373790eea0f22c8f8b3f7a0a914141
repair commit message: Guard BLE discovery state after unmount
failed main CI run: 35547898834
failed CI job: 106177049556
```

The Linux failure is **not an LED-settings failure**. All 223 mobile tests individually reported passed, but Vitest failed the run because of one post-teardown unhandled rejection:

```text
ReferenceError: window is not defined
useShellyBleDiscoveryFlow.ts:108
startBleDiscoveryMutation.onError -> setBleDiscoverySession(null)
originating test file: src/__tests__/navigation-settings-regression.test.tsx
```

Clean Linux timing allowed a pending BLE-discovery start mutation to reject after the component/test environment had already unmounted. The production hook then attempted React state updates after teardown.

A first lifecycle fix is already committed on `work/fix-ble-discovery-unmount-race`: `useShellyBleDiscoveryFlow` now tracks `mountedRef`; remote/ref cleanup may finish after unmount, but React state updates are guarded once unmounted. This change is **not yet validated** and must not be merged blindly.

## Exact next work

Continue the active CI repair only.

1. Fetch `main` and `work/fix-ble-discovery-unmount-race` and verify ancestry from `f4c615c0d...`.
2. Read:
   - `AGENTS.md`
   - `apps/mobile/AGENTS.md`
   - nearest nested AGENTS for touched files
   - this handoff
   - `apps/mobile/src/flows/hardware-setup/useShellyBleDiscoveryFlow.ts`
   - `apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx`
   - `apps/mobile/src/__tests__/navigation-settings-regression.test.tsx`
3. Review the mounted-ref patch instead of assuming it is correct.
4. Add a narrow lifecycle regression test for: pending BLE discovery start settles/rejects after unmount -> no post-unmount React state update/unhandled rejection; remote cleanup guarantees remain intact.
5. Run focused tests first, including `navigation-settings-regression.test.tsx` and relevant hardware-setup/BLE discovery coverage.
6. Run `pnpm quality:repo` if boundaries are touched.
7. Run exactly one accepted final full `pnpm check` for the repair diff.
8. Push/review the repair diff, fast-forward `main`, then verify clean GitHub CI on `main` through responsive smoke.
9. Update this handoff with the repair commit/CI evidence and delete the repair branch.
10. Only after green `main`, begin Slice 3B.

Do not hide the race by adding sleeps, weakening Vitest error handling, suppressing unhandled rejections, or changing CI. Fix lifecycle ownership.

## Night / Local Chat Bridge continuation

Canonical Chat Bridge identity for this project:

```text
repository id: local-climate-link-starter
repository: MichalMatu/local-climate-link-starter
agent_binding: e75c77cb-7589-4452-94b2-decc97ff85a1
execution_enabled: true
control branch: agent-control
managed workspace: /Users/michal/agent-workspace/repos/local-climate-link-starter/work
```

A new ChatGPT conversation must stay hard-bound to this exact repository. The Bridge wake envelope is authoritative:

```text
[LA_AGENT=e75c77cb-7589-4452-94b2-decc97ff85a1]
[LA_REPO=local-climate-link-starter]
[LA_REPOSITORY=MichalMatu/local-climate-link-starter]
[LA_CHAT=<new conversation id>]
```

If the new chat is not yet configured in Chat Bridge, the **user** must add it with the operator command:

```text
[LAB:OP:ADD=local-climate-link-starter]
```

The assistant must never emit/use `LAB:OP:*` as an assistant control and must never rebind itself to another repository.

Autonomous night-loop policy:

- preserve the active goal: repair green CI after Slice 3A, then continue the documented plan;
- on every wake inspect the exact bound-repo daemon/run/result evidence before queueing anything;
- never queue a second task for the same active goal while one is running;
- after queueing a fresh Local Agent task, use `[LAB:NEXT=2m]` for the first liveness check when useful;
- once a build/test task is visibly healthy, use evidence-based `[LAB:NEXT=5m]` to `[LAB:NEXT=10m]` rather than 30-second polling;
- if an exact terminal failure supports a specific fix, create a new immutable task id; never mutate/replay the old payload;
- if progress needs user action, unavailable hardware, credentials, approval, or another repository, use `[LAB:PAUSE]` rather than guessing;
- use `[LAB:STOP]` only when the requested active goal is supported by exact execution/CI evidence;
- do not start 3B while `main` CI is red.

For this repository every Local Agent task must contain exactly:

```json
"agent_binding": "e75c77cb-7589-4452-94b2-decc97ff85a1"
```

## Start-here reading order

Before any new write:

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
exact active run/result evidence
```

Never resume a historical work branch unless this handoff explicitly names it. Right now the only branch to resume is `work/fix-ble-discovery-unmount-race`.

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
-> verify main including CI
-> cleanup completed work branch
```

Do not raise architecture baselines to make a slice fit. New cohesive product modules belong under `apps/mobile/src/features/<feature>`; protocol/domain behavior stays in packages; screens do not own raw transport or persistence.

## Last completed product slice — Slice 3A

Slice 3A is complete and integrated on `main`.

```text
product commit: b0319dddd668c6474b7544c38018518027e3b5f1
message: Complete Plug S LED settings
final docs/integration main: f4c615c0dd8f9c7f9cca064b301119f829ece851
accepted final full check: 20260921-slice3a-final-check-v2
real hardware smoke: 20260921-slice3a-hardware-smoke-v1
live typed-client read: 20260921-slice3a-live-client-read-v1
focused responsive LED E2E: 20260921-slice3a-real-night-window-e2e-v2
```

Implemented contract:

- `@lcl/shelly-client` owns typed `PLUGS_UI` LED protocol for Plug S Gen3: `power | switch | off`, relay ON/OFF RGB + brightness, power brightness and night mode;
- `features/plugs` owns LED settings orchestration/presentation for a physical Plug, with or without installed climate/Time automation;
- every LED read/write verifies live `Shelly.GetDeviceInfo.id` against stable saved `deviceId`; `baseUrl` is reachability only;
- writes are deep partial LED-only patches and never write unrelated `controls`;
- unsupported options are capability-driven;
- legacy installation-owned LED flow/component paths were removed;
- current HTTP remains an adapter under the Shelly client boundary; no speculative BLE transport was added.

Real Plug S Gen3 used for Slice 3A:

```text
URL: http://192.168.0.10/
deviceId: shellyplugsg3-e4b063d7f530
model: S3PL-00112EU
gen: 3
firmware: 1.7.5
fw_id: 20260311-095902/1.7.5-g9979d16
```

Firmware `1.7.5` returns `leds.night_mode.active_between: []` while night mode is disabled. The typed client accepts that real shape. Reversible hardware smoke changed only night brightness `100 -> 7`, confirmed readback, then restored the original full `PLUGS_UI` config; relay was OFF before/after and `Local Climate Link Thermostat` script id `1` remained enabled/running.

Accepted local validation before integration:

- final full `pnpm check` passed in `20260921-slice3a-final-check-v2`;
- focused LED Playwright suite passed `9/9` across mobile/tablet layouts and real empty night-window behavior;
- no dependency, lockfile or architecture-baseline changes.

The later Linux CI failure described at the top is the only blocker before continuing the product plan.

## Next product slice after CI repair — Slice 3B

Selected candidate from the completed audit: **physical button input mode** in `PLUGS_UI.controls["switch:0"].in_mode`.

Target real capability on Plug S Gen3:

```text
momentary | detached
```

Current physical Plug reported `momentary` during the 3A hardware read. `momentary` lets the physical button operate the relay; `detached` decouples the button from relay control.

When 3B starts, keep it a separate settings family from LED:

```text
features/plugs focused button-mode settings UI/flow
        -> @lcl/shelly-client typed PLUGS_UI controls API
        -> ShellyRpcTransport
```

Do not expand the LED editor into a generic settings manager. Reuse stable `deviceId` verification. Write only the narrow `controls.switch:0.in_mode` patch and preserve unrelated LED/controls config. Confirm behavior against current official Shelly docs and real `192.168.0.10` hardware before marking 3B done.

BLE transport remains deferred to Slice 4A+.

## What follows

```text
CI repair after 3A                 ACTIVE
3B  physical button input mode     BLOCKED until main CI green
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
