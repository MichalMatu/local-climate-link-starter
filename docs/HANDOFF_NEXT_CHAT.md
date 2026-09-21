# Next chat handoff — stabilization before BLE

Updated: 2026-09-21

This is the canonical continuation state for `MichalMatu/local-climate-link-starter`.

## Active goal

Do **not** continue Shelly BLE transport work yet.

The active phase is a bounded stabilization pass of the existing product. The user reported core Plug lifecycle regressions on the physical Samsung S22+ after installing the latest app build:

1. the same physical Shelly appeared twice — one card with an automation and one plain Plug card;
2. Plug add/remove behavior was unreliable;
3. after clearing app cache, LAN scan found the Shelly but Add did not successfully complete.

The purpose of the next chat is to reproduce, fix, audit and verify the existing product until it is a trustworthy stable baseline. Only after that baseline is green may BLE feasibility/transport work resume.

## Repository state

```text
repository: MichalMatu/local-climate-link-starter
repository id: local-climate-link-starter
last product/code baseline before stabilization docs: ef6ebd56ea3e92122845a31b5b1d70c7a518f397
active stabilization branch: work/stabilize-plug-lifecycle
control branch: agent-control
Local Agent binding: e75c77cb-7589-4452-94b2-decc97ff85a1
```

The stabilization branch is intentionally based on the same product tree as `main`; the preparation changes after `ef6ebd56...` are documentation-only.

Every Local Agent task for this repository must contain exactly:

```json
"agent_binding": "e75c77cb-7589-4452-94b2-decc97ff85a1"
```

## Active plan

Read and follow:

```text
docs/implementation/stabilization-baseline-plan.md
```

The older `docs/implementation/automation-recovery-editing-shelly-transport-plan.md` is now a historical record of completed Slices 0–3 and the deferred BLE direction. It is not the active execution plan.

## Product invariants

```text
physical Plug -> optional installed automation
bottom navigation: Plugs | Thermometers | Settings
phone: configure/manage/diagnose
Shelly: execute installed automation locally
```

Keep these rules:

- one physical Shelly Plug has one stable normalized `deviceId` identity;
- IP / `baseUrl` is reachability only;
- one physical Plug should appear once in the app;
- a saved Plug remains useful without automation;
- `InstalledAutomation` is durable managed-automation ownership;
- one Plug relay has at most one Local Climate Link managed automation owner;
- Forget Plug is local-only and is not Uninstall Automation;
- explicit uninstall/destructive edits preserve managed identity verification and safe OFF;
- HTTP/LAN remains the current production Shelly transport baseline during stabilization.

## Strong regression lead already found

Static audit found a concrete state-shape mismatch that matches the duplicate-card symptom:

- `useShellyControlFlow.checkShellyMutation` verifies `Shelly.GetDeviceInfo.id` and saves a normalized stable Shelly id;
- `setupDraftStore.upsertShellyDevice` currently deduplicates only exact `id` strings;
- several historical tests still create saved Plug fixtures with `id = http://192.168.../`;
- `AutomationDashboardScreen` matches saved Plugs to `InstalledAutomation` by Shelly identity and renders unmatched installations separately;
- therefore a legacy URL-shaped saved Plug record can coexist with an automation keyed by stable `deviceId`, producing two cards for one physical device.

Turn this into a failing regression test before fixing production code. Do not merely hide one of the cards in presentation.

This lead does **not** by itself explain the Add failure. Treat scan/Add as a separate path:

```text
LAN scan -> narrow Shelly.GetDeviceInfo probe
Add      -> full GetDeviceInfo + status + script list + automation reconciliation + persisted upsert
```

Find the exact failing stage and expose an actionable error instead of guessing.

## Android persisted-state note

Do not assume Android “Clear cache” means Local Climate Link durable WebView/localStorage state is gone. Test retained-data and genuinely fresh-data scenarios explicitly. Do not require the user to manually clear data as a product workaround.

## Exact next work

1. Fetch fresh `main`, active stabilization branch and `agent-control` daemon state. Do not assume the SHA in this handoff is still repository head.
2. Verify there is no active Local Agent task writing the branch.
3. Read root + nearest `AGENTS.md`, this handoff, `docs/implementation/stabilization-baseline-plan.md`, architecture overview/refactor boundaries and the touched Plug/automation owners.
4. Reproduce and add failing tests for:
   - legacy URL-id + stable `deviceId` duplicate Plug card;
   - LAN scan -> Add failure;
   - Forget -> scan -> re-add with an existing managed automation.
5. Perform the preimplementation ownership gate. Fix state/identity owners rather than adding screen-level dedupe hacks.
6. Stabilize Plug persistence and lifecycle first; do not add BLE product code.
7. Run focused tests while iterating, then regression coverage for Climate Edit, Time Edit, pause/resume/delete, LED, button mode, Cloud and relay behavior.
8. Perform a code-quality audit of the touched area: stale URL-as-id fixtures/paths, duplicate ownership, broad errors, lifecycle races, dead compatibility code, architecture budgets.
9. Run real Samsung S22+ + real Shelly Plug lifecycle acceptance, including fresh-data and retained-data scenarios.
10. Close with exactly one accepted final full `pnpm check`, relevant responsive E2E, full diff audit, docs update, fast-forward to `main`, exact-main CI and Sandbox Pack green.
11. Only then resume BLE feasibility/protocol work.

## Real hardware available

Development Plug:

```text
URL: http://192.168.0.10/
deviceId: shellyplugsg3-e4b063d7f530
model: S3PL-00112EU
generation: 3
firmware: 1.7.5
firmware id: 20260311-095902/1.7.5-g9979d16
```

Phone:

```text
Samsung Galaxy S22+
ADB model: SM_S906B
package: link.localclimate.app
app version: 2.0.10 / versionCode 20010
```

Standing hardware-test rule from `AGENTS.md`: the development relay may be toggled ON/OFF when relevant, but leave final state explicit/known and never delete unrelated scripts.

## Existing features that must survive stabilization

The current product already includes and must retain:

- stable-device re-add/reconciliation intent;
- Climate automation edit in place;
- Time automation edit in place;
- pause/resume/manual relay behavior;
- complete Plug S LED settings;
- physical button mode `momentary | detached`;
- Shelly Cloud enable/disable UI (real hardware stays Cloud-disabled during smoke);
- Plug-owned settings/detail navigation;
- Plugs | Thermometers | Settings product model.

Stabilization is not permission to redesign these features unless a concrete defect requires a cohesive correction.

## BLE status — deferred

A preliminary 4A investigation was started and intentionally stopped when the existing product regressions were observed.

Useful facts to retain for later only:

- `@lcl/ble-core` already has a neutral GATT boundary; do not create a second BLE stack;
- `@lcl/shelly-client` should continue to own Shelly RPC/protocol behavior;
- real Plug firmware 1.7.5 reports BLE enabled and RPC enabled in config, while secure provisioning behavior still needs disciplined feasibility evidence;
- no production BLE Shelly transport has been accepted.

Do not continue 4A/4B during stabilization.

## Branch cleanup

Keep:

```text
main
agent-control
work/stabilize-plug-lifecycle
```

The following old work branches were audited as already contained in `main` / no longer active and are cleanup candidates:

```text
work/fix-ble-discovery-unmount-race
work/fix-root-lockfile-v2
work/hardware-setup-shelly-status-boundary
work/installed-automation-feature-foundation
work/installed-automation-feature-foundation-v7
work/plug-button-input-mode
work/plug-cloud-settings
work/slice0-handoff-finalize
work/slice0-handoff-finalize-direct
work/slice1a-forget-preserves-automation
work/slice2a-edit-climate-automation
```

The currently available native GitHub connector does not expose `delete_ref`; do not bypass that limitation with raw `git push origin --delete`. Branch deletion remains explicit cleanup debt until safe deletion tooling is available.

## Canonical read order for the next chat

```text
AGENTS.md
apps/mobile/AGENTS.md
apps/mobile/src/features/AGENTS.md
packages/AGENTS.md
docs/HANDOFF_NEXT_CHAT.md
docs/implementation/stabilization-baseline-plan.md
docs/architecture/overview.md
docs/architecture/refactor-boundaries.md
docs/architecture/feature-boundaries.md
docs/testing/hardware-matrix.md
```

Historical plans are reference only. Current code + canonical architecture docs + this handoff + the stabilization plan win on conflict.
