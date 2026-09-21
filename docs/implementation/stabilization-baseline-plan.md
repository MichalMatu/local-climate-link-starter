# Stabilization baseline plan

Updated: 2026-09-21
Status: active plan

This is the active execution plan before any further Shelly BLE transport work.

## Goal

Create a trustworthy stable baseline of the existing Local Climate Link product before adding another communication layer.

The stabilization phase is complete only when Plug identity/persistence, add/remove/re-add, automation recovery/editing, current Plug settings and native Android behavior are all verified together on the current product architecture.

BLE transport/provisioning is explicitly out of scope until this plan is closed.

## Runtime identity

```text
repository: MichalMatu/local-climate-link-starter
product branch: main
stabilization branch: work/stabilize-plug-lifecycle
control branch: agent-control
Local Agent binding: e75c77cb-7589-4452-94b2-decc97ff85a1
```

Every Local Agent task must contain exactly:

```json
"agent_binding": "e75c77cb-7589-4452-94b2-decc97ff85a1"
```

## Product invariants

Keep these unless the user explicitly changes the model:

- one physical Shelly Plug has one stable `deviceId` identity;
- IP / `baseUrl` is reachability only;
- one physical Plug appears once in the app;
- a Plug may exist without an automation;
- a Plug may own at most one managed relay automation;
- Forget Plug is local-only; Uninstall Automation is remote/destructive;
- `InstalledAutomation` remains the durable automation record;
- the phone configures/manages/diagnoses; Shelly executes installed automation locally;
- boot/stale/destructive behavior remains safe-OFF;
- current LAN/HTTP behavior remains the product transport baseline during stabilization.

## Known regressions to reproduce first

Observed on the physical Samsung S22+ with the latest app build:

1. the same physical Plug appeared twice — one card with an automation and one plain Plug card;
2. Plug add/remove behavior was unreliable;
3. after the user cleared app cache, LAN scan found the Shelly but Add did not successfully complete.

Static audit already found a plausible identity split that must be turned into regression tests before fixing:

- `checkShellyMutation` creates saved Plug records from verified `Shelly.GetDeviceInfo.id`;
- `setupDraftStore.upsertShellyDevice` currently deduplicates only exact `id` strings;
- historical tests still create saved Plug fixtures whose `id` is an HTTP URL;
- the dashboard renders unmatched `InstalledAutomation` records as separate entries;
- therefore a legacy URL-shaped saved Plug id can coexist with an automation keyed by stable Shelly `deviceId` and render as two cards.

Do not assume this explains every add failure. LAN scan and Add have different RPC depth: scan is a narrow identity probe, while Add performs full status/script/reconciliation work.

## Phase S0 — reproduce and lock failing behavior

Before production edits:

- fetch fresh `main` and verify daemon/repository binding;
- inspect root/mobile/features/package `AGENTS.md` relevant to touched files;
- reproduce the duplicate-card state deterministically;
- reproduce scan -> Add failure separately;
- reproduce Forget -> scan -> re-add when an existing managed automation is present;
- add focused failing regression tests for the confirmed cases;
- distinguish persisted-state defects from live RPC/network failures;
- do not make BLE changes while reproducing.

Important Android note: do not use “Clear cache” as proof that durable app/WebView state was removed. Test explicit fresh-data and retained-data scenarios separately.

## Phase S1 — one physical Plug, one canonical identity

Audit and fix the state owner, not just presentation.

Acceptance:

- saved Plug identity is stable normalized Shelly `deviceId`;
- URL/IP never becomes a physical-id substitute in new production state;
- same physical `deviceId` cannot coexist twice because of different endpoint strings/casing;
- legacy/development state that conflicts with the current identity contract is handled deterministically rather than producing duplicate cards;
- dashboard matching does not hide ownership conflicts;
- tests stop using URL-shaped Plug ids except an explicit legacy-state regression fixture.

Do not introduce a permanent dual-schema compatibility layer solely for development history. Prefer one canonical state shape and a bounded normalization/recovery path if one is required.

## Phase S2 — Plug lifecycle

Prove the complete lifecycle:

```text
fresh app data
-> LAN scan
-> Add
-> app restart
-> settings/runtime read
-> Forget Plug
-> scan again
-> Add same physical Plug again
```

Acceptance:

- scan result Add succeeds or surfaces an actionable specific error;
- no duplicate saved Plug is created;
- Forget removes local Plug state only;
- re-add uses live `deviceId` and current reachability;
- route/selection/transient control state cannot point at a removed stale Plug;
- repeated Add of the same physical device is idempotent/upsert behavior, not duplication.

## Phase S3 — automation ownership and recovery

With climate and Time fixtures, verify:

- saved Plug + installed automation renders one Plug-owned card;
- Forget Plug preserves durable `InstalledAutomation` and remote runtime;
- re-add of the same `deviceId` re-associates/reconciles the existing automation;
- re-add at a changed IP updates reachability without changing automation identity;
- Climate Edit updates the existing managed script safely;
- Time Edit updates the existing schedule pair safely;
- pause/resume/manual/relay controls keep the existing identity and safe-OFF contracts;
- uninstall/delete remains distinct from Forget.

No heuristic adoption of arbitrary Shelly scripts/schedules.

## Phase S4 — existing Plug settings regression pass

Verify current shipped settings families without expanding scope:

- LED settings;
- physical button input mode;
- Shelly Cloud enable/disable;
- plain Plug relay ON/OFF;
- telemetry/status refresh;
- settings/detail navigation.

Hardware-mutating checks must restore or explicitly record final state. Shelly Cloud must not be enabled on real hardware merely for a smoke test.

## Phase S5 — code-quality audit

After correctness fixes, audit the complete touched area for:

- single ownership of durable Plug state and installed automation state;
- URL-as-identity leakage;
- duplicate or obsolete compatibility paths;
- screen/facade transport or persistence leakage;
- stale tests that encode pre-identity architecture;
- broad error messages that hide the actual Add failure stage;
- React lifecycle/query races around add/remove/recheck;
- dead code and needless adapters left by previous refactors;
- TypeScript strictness, error handling and resource cleanup;
- architecture/UX budgets without raising baselines to make the work pass.

Delete obsolete code when its replacement is proven. Do not start unrelated repository-wide refactors.

## Phase S6 — native and hardware acceptance

Use the real Samsung S22+ and the development Plug S Gen3.

Required end-to-end smoke:

1. install the exact stabilization build while preserving data when testing retained-state behavior;
2. separately test a genuinely fresh app-data state;
3. LAN scan finds the real Plug;
4. Add succeeds;
5. only one Plug card exists;
6. current automation is correctly associated/recovered if present;
7. Plug settings page opens and reads live state;
8. Forget works;
9. re-scan + re-add succeeds;
10. automation recovery is correct;
11. edit the existing automation through the UI and verify live runtime/readback;
12. verify plain relay/manual controls where safe;
13. final relay state is explicit and known.

Record exact device/model/firmware/build SHA and any hardware mutations in `docs/testing/hardware-matrix.md`.

## Phase S7 — stable baseline closeout

Before declaring the baseline stable:

- focused regression suites pass;
- `pnpm quality:repo` and relevant UX gates pass;
- responsive E2E covers the lifecycle surfaces touched;
- exactly one accepted final full `pnpm check` passes on the final product tree;
- complete diff/ownership audit passes;
- real S22+ + Plug lifecycle smoke passes;
- canonical docs describe actual behavior;
- stabilization branch fast-forwards cleanly to `main`;
- exact-main CI and Sandbox Pack are green;
- handoff explicitly says stabilization complete.

Only then resume BLE feasibility/protocol work.

## Deferred phase — BLE

The previous Slice 4A investigation gathered partial protocol/hardware evidence, but it is not the active workstream.

Do not implement a production BLE `ShellyRpcTransport`, BLE provisioning, fallback selection or additional BLE-backed product capability during stabilization.

After the stable baseline is accepted, resume with a fresh bounded BLE feasibility review against that stable codebase. Reuse existing `@lcl/ble-core` GATT boundaries and `@lcl/shelly-client` protocol ownership; do not create a parallel product stack.

## Definition of stable

“Stable” here means the existing user journeys are demonstrably coherent, not merely that unit tests pass:

```text
one physical Plug
= one stable identity
= one card
= predictable add/forget/re-add
= correct optional automation ownership
= editable existing automation
= working current settings
= real Android + real Shelly evidence
= green repository gates/CI
```
