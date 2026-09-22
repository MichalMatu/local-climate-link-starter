# Handoff — per-sensor Plug diagnostics

Status: **2026-09-22**

## Start here

Repository: `MichalMatu/local-climate-link-starter`

Work only on:

```text
work/per-sensor-diagnostics
```

Do not modify `main` directly.

The branch was created from `main` commit:

```text
699e6ac7845838cbce114aab513d4ff73e972a1a
```

PR #34 is already merged in that baseline. The preimplementation audit for this slice is complete. Do **not** restart a broad architecture audit unless the branch changed underneath you.

Local Agent binding for this repository:

```text
e75c77cb-7589-4452-94b2-decc97ff85a1
```

Before writing code, verify the branch is current, the Local Agent daemon is healthy/idle, and no duplicate task is already running for this goal.

Read only the canonical context needed for this slice:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- this file
- `docs/testing/hardware-matrix.md` before any hardware acceptance

Historical plans belong in Git history; do not rebuild them in new notes.

## Goal

Expose distinct Plug-side live diagnostics for every configured Climate thermometer and map them back to the correct mobile sensor row by normalized physical BLE `runtimeAddress`.

The UI should be able to distinguish:

- `Phone BLE` live data;
- `Plug BLE` live data;
- recovered/runtime identity provenance;
- fresh vs stale Plug-side data.

This work must not change Climate aggregation, rule evaluation, relay safety, or safe-OFF semantics merely to support presentation diagnostics.

## Audit result — ownership and current gaps

### Shelly runtime

Owner: `packages/script-generator/src/shelly/generate.ts`

The runtime already stores per-sensor measurements in `R.u[j]`.

Current tuple meaning:

```text
R.u[j] = [temperature, humidity, temperatureUptimeMs, humidityUptimeMs, batteryPct, rssi, ...]
```

`meas(...)` writes those fields and aggregation reads the same per-sensor state. The configured sensor order is deterministic through `packages/script-generator/src/shelly/runtimeConfig.ts`: primary first, then additional sensors, up to `MAX_CLIMATE_SENSORS = 8`.

Current `/diag` exposes aggregate values only. Its existing `u` field is aggregate metadata (`freshCount`, configured sensor count, aggregation mode); mobile currently ignores that field. Do not repurpose existing fields incompatibly. Add a compact optional per-sensor diagnostic extension while preserving old payload compatibility.

### Mobile diagnostics decoder/cache

Decoder owner: `apps/mobile/src/flows/hardware-setup/schemas.ts`

Fetch/cache owner remains the existing installed-automation diagnostics query path. Do not add another mutable diagnostics store.

The current schema only exposes aggregate `lastTemp`, `lastHumidity`, battery, RSSI and aggregate last-seen state. Extend it backward-compatibly so old runtimes still parse.

### Rule sensor reading projection

Owner: `apps/mobile/src/flows/hardware-setup/useRuleSensorReadings.ts`

Current bug/limitation: aggregate Plug diagnostics are attributed to the installation's **primary** sensor only. Additional configured thermometers therefore cannot receive their own Plug-side values/provenance.

Change the projection so an installation participates when **any configured sensor** belongs to the current rule sensor set, then map each per-sensor runtime diagnostic record by normalized `runtimeAddress`.

Phone-side readings remain owned by `sensorReadingsStore.ts`. Do not duplicate them into a new store.

### Recovered identity provenance

Existing persistence already owns recovered/inherited membership:

- `apps/mobile/src/features/automations/data/climateAutomationEditDraft.ts`
- `apps/mobile/src/features/hardware-setup/data/setupDraftPersistence.ts`

Reuse `inheritedSensorIds` / `inheritedSensorSourceId`. If presentation needs the recovered marker, pass the existing state through the flow/page boundary with the smallest change necessary.

Do **not** encode `recovered` as a telemetry source. Recovery describes identity origin; live telemetry source remains Phone BLE or Plug BLE.

### UI boundary

Presentation owner: `apps/mobile/src/features/automations/components/ClimateRuleDeviceSelectors.tsx`

Keep transport and persistence logic out of the component. It should receive an already-resolved reading/provenance model and render compact status only.

Avoid creating more feature-specific global CSS unless unavoidable.

## Two critical correctness issues found by the audit

### 1. Old managed runtimes need an explicit upgrade path

`apps/mobile/src/features/automations/flows/updateClimateInstalledAutomation.ts` currently prefers persistent config-only edit when the installed runtime supports it. That keeps the existing engine bytes/hash unchanged.

Therefore an already-installed pre-diagnostics runtime would **never** gain the new `/diag` shape through an ordinary config-only edit unless capability handling changes.

Required behavior:

- add a structural capability predicate for per-sensor diagnostics;
- if a managed runtime lacks that capability, the next **explicit Save/Edit** may take the existing guarded script-replacement path once;
- preserve the existing script identity/lifecycle checks and force-safe relay behavior;
- after upgrade, later compatible edits may return to config-only updates;
- simply opening diagnostics, Edit, or reading `/diag` must never rewrite the runtime.

Do not use generator version alone when a structural capability check can prove support.

### 2. Config-only edit must clear indexed per-sensor runtime state

`packages/script-generator/src/shelly/runtimeConfigUpdate.ts` resets aggregate runtime values after `C=N`, but currently does not reset `R.u` or `R.fc`.

If sensor membership/order changes, old indexed entries could be reinterpreted as a different thermometer.

The config-update path must clear per-sensor diagnostic/freshness state (at minimum `R.u` and `R.fc`) so removed/reordered sensors cannot retain or inherit stale Plug-side values.

Add a regression test for this.

## Implementation contract

Implement the smallest vertical slice that satisfies all of the following:

1. Generated Climate runtime exposes one compact optional diagnostic record per configured thermometer.
2. Each record can be joined to the configured normalized `runtimeAddress` without inventing another identity.
3. Per-sensor data includes temperature, humidity, battery, RSSI and enough uptime timing to derive its own last-seen/age and stale/fresh display state.
4. An unseen configured sensor has an explicit empty/unseen representation; aggregate values must never be copied into every sensor row.
5. Removing/reordering sensors through config-only edit clears old indexed state.
6. Existing aggregation helpers and safe-OFF decisions are unchanged unless a test proves a real existing bug unrelated to presentation.
7. Mobile schema accepts both old and new runtime payloads.
8. `useRuleSensorReadings` maps Plug readings for all configured sensors, not only the primary sensor.
9. Reading acquisition source and recovered identity provenance remain separate concepts.
10. No new mutable sensor-reading store, device identity, cloud dependency, MQTT dependency, or server ownership model is introduced.

For Plug-side display freshness, derive age from that sensor's own measurement uptime, not aggregate `R.ls`. Keep control freshness semantics exactly where they already live.

## Tests required before hardware

### Script generator/runtime

Add focused regressions covering:

- distinct values for at least two configured sensors;
- unseen sensor representation;
- per-sensor last-seen timing/freshness data;
- config update clearing `R.u` / `R.fc`;
- per-sensor diagnostics structural capability detection;
- existing aggregation and safe-OFF behavior unchanged;
- generated Shelly script remains within the existing `<= 8000` byte limit.

Primary test owner: `packages/script-generator/src/__tests__/generator.test.ts` plus focused capability/config-update tests where appropriate.

### Mobile

Cover:

- old aggregate-only `/diag` still parses;
- new per-sensor payload parses;
- primary and additional sensors receive their own Plug readings;
- removed/unseen sensor cannot retain an unrelated Plug value;
- Phone BLE vs Plug BLE selection/provenance remains deterministic;
- recovered identity marker is independent from live reading source;
- edit of an old managed runtime lacking the new capability selects the guarded upgrade path only on explicit Save/Edit.

Keep tests near existing runtime diagnostics, rule sensor reading and installed-automation edit coverage.

## Verification sequence

After implementation:

1. run the focused generator/runtime tests;
2. run focused mobile diagnostics/readings/edit tests;
3. run the repository's normal `pnpm check` / full gate required by `AGENTS.md`;
4. review generated script byte size and runtime-memory impact;
5. only then proceed to real-device acceptance.

## Hardware acceptance guardrails

Target hardware remains the documented Shelly Plug S Gen3 + Samsung S22+ matrix. Re-read `docs/testing/hardware-matrix.md` before touching hardware because historical script hashes are evidence, not instructions for the current runtime.

For the hardware step:

- verify the physical Shelly identity before mutation;
- preserve the managed script ID when performing an upgrade/edit;
- ensure relay is forced OFF before/after the safety-sensitive update path as required by the existing lifecycle;
- verify final runtime config and per-sensor diagnostics on real sensors;
- confirm schedules were not unintentionally changed;
- finish in a known safe relay state;
- append dated evidence to `docs/testing/hardware-matrix.md` only after the real acceptance actually passes.

## Non-goals / do not reopen

- no broad refactor phase;
- no second automation ownership model;
- no URL/IP-as-device identity;
- no automatic runtime rewrite while merely reading diagnostics;
- no change to Climate aggregation semantics for this presentation slice;
- no weakening of boot OFF, stale-sensor OFF, max-on, min-relay-change or identity-verification safeguards;
- no unrelated soil-moisture/timing/template work in this branch.

When this slice is complete, update this handoff again or replace it with the next concrete task instead of appending a long historical diary.
