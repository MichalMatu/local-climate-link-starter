# Local Climate Link — next functional steps

Updated: 2026-09-17

Current code checkpoint after architecture cleanup:

```text
c67ac66c10e076e4b5d798e11bf117eefca49ea3
Tighten hardware setup boundaries
```

The last code physically installed on the Samsung S22+ is still:

```text
19bbd0ccf87f5490a216ca4ec302acf9c5b5a7ac
Compact thermometer card details
```

The phone was unavailable after the cleanup, so physical QA of the current checkpoint is still pending.

## Current product model

The primary mental model remains:

```text
physical Plug -> control method / installed automation
```

Keep these accepted decisions:

- bottom navigation is **Plugs | Thermometers | Settings**,
- `+` on Plugs adds a physical Plug,
- automation setup starts from a concrete Plug and keeps that context,
- Time is a Plug automation type, not a global dashboard section,
- `InstalledAutomation` remains the durable installed-automation entity,
- a plain saved Plug remains useful for telemetry, direct relay control and later automation assignment,
- both phone BLE and Shelly-side BLE discovery use the same sensor/readings model,
- user display name is separate from hardware identity (`model` + `gen`),
- no independent global Rules/ownership surface is planned without a concrete requirement.

## Architecture cleanup status

The immediate architecture debt identified by the 2026-09-17 re-audit is now resolved.

Completed in `c67ac66c...`:

- Shelly setup presentation was split across focused presentation/modal boundaries instead of raising the repository line budget,
- saved thermometer card presentation was moved out of `SensorSetupPage.tsx`,
- generic Shelly setup no longer exposes the legacy AUTO/MANUAL runtime path,
- `useShellyControlFlow` is narrowed to physical status/direct relay responsibilities,
- installed automation mode ownership remains in `flows/installations/*`,
- tests were rewritten to assert that generic setup does not send `Script.Start`, `Script.Stop` or `Switch.Set` runtime mutations,
- a dashboard refresh-loop regression introduced during lint cleanup was found by testing and fixed before commit.

Final standard verification passed twice through `pnpm check`, including 31/31 mobile test files and 171/171 mobile tests, core coverage gate and production build.

## Current dashboard state

### Plugs

A physical Plug is the main dashboard entity.

A plain Plug card provides:

- editable user name,
- live power/voltage/energy/time,
- direct ON/OFF,
- physical-device settings,
- `Dodaj automatykę`.

A Plug with an installed climate/time automation renders the corresponding installed-automation card and uses the `InstalledAutomation` runtime/status path.

Concrete Plug settings show model/gen + compatibility, address, firmware, Wi-Fi RSSI, uptime, NTP sync/timestamp, Scripts, Bluetooth and Matter. They also expose Shelly-side BLE thermometer discovery and app-only Plug removal.

### Thermometers

Thermometers are a first-class bottom-navigation surface. Saved cards show:

- editable user name,
- latest temperature and humidity,
- battery/voltage, RSSI and last reading time,
- latest reading source,
- Details disclosure with type and MAC.

Phone BLE and Shelly-side discovery converge on the same saved sensor/readings model.

## Next small UX slice

The next agreed implementation is now safe to start on the new saved-sensor presentation boundary:

- add a Tabler thermometer/temperature icon at the upper-left of each saved thermometer card,
- align icon/name/actions with Plug-card header rhythm,
- briefly turn the icon blue only when that sensor's existing latest sample `seenAtMs` strictly advances,
- return to normal after the transient animation,
- do not trigger on mount, rerender, tab switch or global scan lifecycle,
- do not create another sensor store or freshness domain state.

The existing readings store remains the semantic source of truth. Animation state is presentation-only.

## Automation ownership rules

### Climate

Climate automation remains the generated local climate runtime with the accepted safety model.

AUTO/MANUAL invariants:

- the exact managed script remains running in AUTO and MANUAL,
- MANUAL blocks automatic output decisions inside the runtime,
- relay safety stays under verified runtime ownership,
- generic hardware setup is not an automation-mode control surface.

### Time

Pure time automation belongs to a concrete Plug and uses native Shelly Schedule. It is not a global Time surface.

Keep one relay owner. Do not let climate runtime and an unrelated native schedule both drive the same relay without a separately designed combined-control model.

### Durable entity

`InstalledAutomation` remains authoritative. Do not infer ownership from setup selection, IP address, generated script text or a new registry.

## Sensor rules

- phone BLE is setup/live-reading input, not the autonomous runtime controller,
- Shelly-side BLE discovery uses the existing temporary discovery flow and same sensor store,
- sample source may differ, but there is one per-sensor latest-reading model,
- MAC remains available under Details for identification/debugging,
- do not add a second freshness model for UI animation.

## Diagnostics/logging

The repo already has `@lcl/diagnostics` plus `runtimeDiagnostics.ts`.

Do not add another logger module now. After physical S22+ QA, only add missing structured events if `adb logcat` shows a concrete observability gap. Keep logs bounded, redacted and low-noise.

## Physical QA pending

When the S22+ is available again:

1. build/install the exact current branch checkpoint,
2. smoke-test Plugs, Thermometers, Settings and Plug settings,
3. capture clean `adb logcat` around launch/navigation,
4. inspect AndroidRuntime, Capacitor/WebView/JS errors and ANRs,
5. record the installed SHA and physical result in docs.

Use the existing repo Android/ADB workflow rather than inventing a parallel one.

## Deferred product work

Later candidates, not the immediate next slice:

- expanded Shelly `PLUGS_UI` LED configuration,
- additional Plug hardware families after capability/hardware-identity audit,
- richer thermometer management only when a concrete workflow requires it,
- combined time + climate control only after explicit relay-ownership design,
- VPD algorithm changes only in a dedicated runtime/algorithm audit.

Do not reopen stable climate runtime code for unrelated device/UI work.

## Development order

Current order:

1. keep architecture/product documentation synchronized,
2. implement the small thermometer leading-icon/new-sample pulse slice,
3. run focused tests and the normal repository gate/build for the touched scope,
4. when the phone is available, install and perform physical S22+ smoke/logcat QA,
5. then choose the next product feature from current evidence.

Do not claim a new physical release baseline until the S22+ verification is actually complete.
