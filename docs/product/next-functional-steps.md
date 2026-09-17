# Local Climate Link — next functional steps

Updated: 2026-09-17

Current product-code checkpoint after architecture cleanup:

```text
c67ac66c10e076e4b5d798e11bf117eefca49ea3
Tighten hardware setup boundaries
```

Documentation-only commits later advanced the branch, and the cleanup code has now been rebuilt and physically installed from branch HEAD `0463af650bd647ebe300b7ec161323fda58e7520` on the Samsung S22+.

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

The immediate architecture debt identified by the 2026-09-17 re-audit is resolved.

Completed in `c67ac66c...`:

- Shelly setup presentation was split across focused presentation/modal boundaries instead of raising the repository line budget,
- saved thermometer card presentation was moved out of `SensorSetupPage.tsx`,
- generic Shelly setup no longer exposes the legacy AUTO/MANUAL runtime path,
- `useShellyControlFlow` is narrowed to physical status/direct relay responsibilities,
- installed automation mode ownership remains in `flows/installations/*`,
- tests assert that generic setup does not send `Script.Start`, `Script.Stop` or `Switch.Set` runtime mutations,
- a dashboard refresh-loop regression introduced during lint cleanup was found by testing and fixed before commit.

Final standard verification passed twice through `pnpm check`, including 31/31 mobile test files and 171/171 mobile tests, core coverage gate and production build.

## Physical Android QA status

The architecture-cleanup checkpoint is now physically validated at launch/runtime level on the reference phone.

Reference device and installed app:

```text
Samsung SM-S906B
Android 16 / API 36
link.localclimate.app
versionName 2.0.10
versionCode 20010
```

Evidence from Local Agent tasks:

- `20260917-phone-alpha-smoke-v22`: normal `pnpm android:phone-alpha` clean rebuild/install/cold start completed successfully;
- `20260917-phone-focused-smoke-v23`: `MainActivity` was the focused and top-resumed activity and the WebView was present;
- `20260917-phone-webview-probe-v24`: one live page target was exposed as `Local Climate Link` at `https://localhost/` with a debugger WebSocket;
- filtered ADB logs showed no app `FATAL EXCEPTION` and no ANR;
- repository state remained clean after the device checks.

This closes the previous “physical QA pending” blocker for the cleanup itself. It is intentionally a launch/runtime smoke baseline, not a claim that every screen, BLE discovery path or hardware mutation was manually exercised. Each future feature should still receive focused physical QA for the interaction it changes.

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

The next agreed implementation is safe to start on the new saved-sensor presentation boundary:

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

The physical launch/logcat smoke did not show a concrete observability gap that justifies another logger module. Add future diagnostics only through the existing bounded/redacted paths when a real device flow lacks evidence. Avoid noisy console instrumentation and raw secrets/device identifiers unless strictly necessary.

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
4. install that change on the S22+ and run focused device/logcat QA,
5. then choose the next product feature from current evidence.

The architecture-cleanup baseline now has both repository-gate verification and physical Android launch/runtime smoke evidence.
