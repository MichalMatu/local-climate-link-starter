# Refactor boundaries

Updated: 2026-09-17

Current cleanup checkpoint:

```text
c67ac66c10e076e4b5d798e11bf117eefca49ea3
Tighten hardware setup boundaries
```

File size remains an alarm, not a refactor goal. Split only at a real responsibility boundary or to remove a concrete duplicate state/RPC path.

## Product/domain ownership

The product remains Plug-centric:

```text
physical Plug -> zero or one installed automation for that relay
```

Keep these boundaries:

- `InstalledAutomation` is the durable installed-automation entity.
- `setupDraftStore.ts` owns setup inputs plus saved Plug/Sensor metadata; it is not a second automation registry.
- physical Plug metadata and user display name are not automation identity.
- Time is attached to a concrete Plug, not a global Time domain/surface.
- phone BLE and Shelly-side BLE discovery feed the same saved-sensor/readings model.

Do not introduce a global ownership registry unless a concrete product requirement demands it.

## Dashboard boundary

`AutomationDashboardScreen.tsx` still composes installed automation cards, plain Plug cards, Plug settings and Thermometer embedding. Do not split it merely for line count.

Two real seams remain:

1. saved Plug -> `InstalledAutomation` reconciliation by normalized `baseUrl` can become a small pure selector if that area is next changed,
2. `PlainPlugCard` can be extracted when doing so removes duplicated physical-control state or makes a concrete change safer.

The final cleanup also fixed a transient refresh-loop regression discovered during verification. Physical Plug refresh is keyed to `device.id` / `baseUrl`; a ref holds the latest refresh function so effect dependencies do not create repeated refreshes.

## Physical Plug control versus installed automation control

An unconfigured Plug may use the physical-device control path for status/direct relay control on the dashboard. Installed climate/time automation must use `flows/installations/*` runtime ownership and safety checks.

The previous generic hardware-setup AUTO/MANUAL path has now been removed. Generic setup no longer exposes `setAutomationAuto` / `setAutomationManual` or the old `Script.Start` / `Script.Stop` mode semantics.

Accepted installed-runtime invariants remain:

- AUTO/MANUAL changes happen inside the running managed runtime,
- normal mode switching does not stop/start the managed script,
- MANUAL keeps the exact managed script running while blocking automatic output decisions,
- direct ON/OFF requires verified ownership/capability.

Temporary script stop/restart used specifically by Shelly BLE-discovery cleanup remains a separate lifecycle concern and is intentionally preserved.

## Hardware setup facade

`useHardwareSetupFlow.ts` remains a composing facade. It delegates the main subsystems:

- `useShellySetupScanFlow.ts` — LAN scan inputs, execution, progressive results and cancellation,
- `useHardwareDiagnosticsFlow.ts` — diagnostic/resource snapshots,
- `useClimateAutomationInstallFlow.ts` — install/conflict handling and safe relay test,
- `useShellyControlFlow.ts` — physical Shelly status/direct relay control only,
- `useShellyBleDiscoveryFlow.ts` — temporary Shelly-side BLE discovery lifecycle and cleanup,
- `usePhoneSensorFlow.ts` — phone BLE scan/live scan/GATT coordination and sensor ingestion.

It still owns the older residual setup/script orchestration cluster (`check/recheck`, `setupStatus`, setup-script load/delete). Do not extract those during unrelated UX work unless a concrete lifecycle conflict appears.

## LAN scan boundary

`useShellySetupScanFlow.ts` stays focused. Preserve:

- full requested-range scanning,
- progressive result publication,
- duplicate URL suppression,
- AbortController cancellation,
- tolerant editing with validation when scan starts.

Do not move scan lifecycle back into `ShellySetupPage.tsx`.

## Shelly setup presentation

The previous 811-line composition regression was resolved without raising the repository budget.

Shelly setup now uses focused presentation/modal boundaries including:

- `ShellySetupPresentation.tsx`,
- `ShellySettingsModal.tsx`,
- `ShellyBleDiscoveryModal.tsx`.

Transport and lifecycle remain behind existing flows/hooks. No new setup store or RPC layer was introduced.

Generic saved-Shelly setup presentation no longer owns runtime automation mode controls. It retains setup/status/settings/BLE-discovery responsibilities.

## Sensor setup presentation

The previous 691-line `SensorSetupPage.tsx` composition regression was also resolved without raising its budget.

Saved thermometer presentation is now separated into `SensorSetupPresentation.tsx`. Phone BLE lifecycle remains in `usePhoneSensorFlow`; the page remains composition/orchestration rather than radio ownership.

This saved-sensor presentation boundary is the preferred place for the pending thermometer leading icon and fresh-sample pulse.

### Fresh-sample semantics

`sensorReadingsStore.ts` remains the single per-sensor reading source. A genuinely new sample is represented by a strictly newer `seenAtMs`.

For the future blue icon pulse:

- derive it from `seenAtMs` advancing,
- do not pulse on mount, tab switch or ordinary rerender,
- do not use global scan timestamps as per-sensor freshness,
- do not add a second freshness store.

Component-local animation state is acceptable only as transient presentation.

## Store boundaries

`setupDraftStore.ts` remains setup/device metadata. Persisted rule fields there are setup inputs, not installed automation ownership.

`sensorReadingsStore.ts` remains ephemeral latest-reading state shared by both BLE discovery paths.

Do not create source-specific copies or a second installed-automation ownership model.

## Diagnostics/logging boundary

Do not create a second logger package.

Existing boundaries already cover the two required concerns:

- `@lcl/diagnostics` — bounded diagnostic events, redaction and support export,
- `runtimeDiagnostics.ts` — WebView/browser runtime errors and unhandled rejections.

Any future logging improvement should add sparse structured events through these existing boundaries. Avoid noisy `console.log` instrumentation and avoid raw sensitive identifiers where they are not required.

## Test boundaries

Prefer roles, accessible names, visible state and RPC effects over implementation-class assertions when tests are touched.

The generic Shelly setup tests now explicitly prove absence of `AUTO`, `MANUAL`, `ON`, `OFF` runtime controls and absence of `Script.Start`, `Script.Stop`, `Switch.Set` mutations from that setup surface.

Do not split large scenario tests solely for file size.

## Current quality state

Final Local Agent verification on `c67ac66c...` restored the repository architecture gate and completed the full standard check:

```text
pnpm check
```

It passed before commit and again in the pre-push hook. Mobile tests in both complete runs reported:

```text
Test Files  31 passed (31)
Tests       171 passed (171)
```

Formatting, lint, `quality:ux`, `quality:repo`, typecheck, workspace tests, core coverage gate and production build all passed.

The cleanup is therefore accepted at code/test/build level. Physical S22+ install/smoke/logcat remains pending because the phone was unavailable.

## What to leave alone

Do not currently refactor:

- `useShellySetupScanFlow`,
- `useShellyBleDiscoveryFlow`,
- `usePhoneSensorFlow`,
- the readings/store split,
- `setupDraftStore` into a new ownership model,
- `useHardwareSetupFlow` solely because it is large,
- installed-runtime safety modules,
- locale dictionaries or scenario-heavy tests by line count alone.
