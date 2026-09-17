# Refactor boundaries

Updated: 2026-09-17

This document records the current responsibility boundaries after the read-only re-audit of `main..work/plug-screen-automation-entry-20260917` at branch head `8b5044cb7d653f38681c8c12315ff9ad593ba256`. The last product-code SHA built and installed on the physical S22+ remains `19bbd0ccf87f5490a216ca4ec302acf9c5b5a7ac`; `8b5044cb...` is the later handoff-only commit.

File size is an alarm, not a refactor goal. Split only at a real responsibility boundary or to remove a concrete duplicate state/RPC path.

## Product/domain ownership

The current product model is Plug-centric:

```text
physical Plug -> zero or one installed automation for that relay
```

Keep these boundaries:

- `InstalledAutomation` is the durable automation entity and owns installed climate/time configuration identity.
- `setupDraftStore.ts` owns setup inputs plus saved Plug/Sensor metadata; it must not become a second automation ownership registry.
- physical Plug identity/metadata and user display name are not automation identity.
- Time is an automation type attached to a concrete Plug, not a global Time domain/surface.
- phone BLE and Shelly-side BLE discovery persist thermometers into the same sensor draft store and feed the same readings store.

Do not introduce a global Rules/ownership registry to reconcile these objects unless a concrete product requirement demands it.

## Dashboard boundary

`AutomationDashboardScreen.tsx` is currently about 579 lines. Its subcomponents are individually understandable, and the screen still uses the installed-automation runtime boundary instead of calling Shelly RPC directly. Do not split it merely because of line count.

There are, however, two real seams to keep visible:

1. mapping saved physical Plugs to `InstalledAutomation` is currently performed inline by normalized `baseUrl`; this is reconciliation/domain-selection logic rather than rendering and is a good candidate for a small pure selector/helper when the area is next changed,
2. `PlainPlugCard` owns physical Plug status/relay UI while the screen also owns installed automation cards, Plug settings overlay and Thermometer embedding. Extract the physical Plug card only when doing so removes duplicated control state or makes a concrete change safer.

Do not replace the current association with a second persisted ownership model. The existing `InstalledAutomation` remains authoritative for automation.

### Physical Plug control versus installed automation control

An unconfigured Plug may use the physical-device control path for status and direct relay ON/OFF. An installed climate automation must use the `flows/installations/*` runtime-control path with exact installation/script verification.

The re-audit found a legacy duplicate automation-control path still reachable from hardware setup: `useShellyControlFlow.ts` exposes `setAutomationAuto` / `setAutomationManual`, and `SavedShellyDeviceCard` wires those actions to `Script.Start` / `Script.Stop`. That is not the accepted runtime AUTO/MANUAL model.

The accepted installed-runtime semantics remain:

- AUTO/MANUAL changes happen inside the running managed runtime,
- normal AUTO/MANUAL switching must not use `Script.Stop` / `Script.Start`,
- MANUAL keeps the exact managed script running while blocking automatic output decisions,
- direct ON/OFF is allowed only after verified MANUAL ownership/capability.

Therefore the legacy AUTO/MANUAL controls in generic Shelly setup are architectural debt and should be retired/narrowed rather than expanded. Keep `useShellyControlFlow` for physical status and direct relay control where appropriate. Do not confuse this with temporary BLE-discovery cleanup, which may stop/restart the managed script as part of its explicit safety lifecycle.

## Hardware setup facade

`useHardwareSetupFlow.ts` is about 586 lines and remains below its 650-line repository budget. It is best described as a composing facade with a small residual setup/script orchestration cluster, not as a pure pass-through facade.

It correctly delegates the main subsystems:

- `useShellySetupScanFlow.ts` — LAN scan inputs, execution, progressive results and cancellation,
- `useHardwareDiagnosticsFlow.ts` — diagnostic/resource snapshots,
- `useClimateAutomationInstallFlow.ts` — install/conflict handling and safe relay test,
- `useShellyControlFlow.ts` — physical Shelly status/relay lifecycle, plus the legacy AUTO/MANUAL debt described above,
- `useShellyBleDiscoveryFlow.ts` — temporary Shelly-side BLE discovery lifecycle and cleanup,
- `usePhoneSensorFlow.ts` — phone BLE scan/live scan/GATT coordination and sensor ingestion.

It still owns `checkShellyMutation` / `recheckShellyMutation`, `setupStatus`, and load/delete setup-script orchestration. Those are older residual responsibilities, not a regression introduced by the 2026-09-17 Plug/Thermometer pass. Do not extract them during unrelated UX work unless the public facade starts growing again or a concrete lifecycle conflict appears.

## LAN scan boundary

`useShellySetupScanFlow.ts` is focused and should stay that way. Preserve all current semantics:

- full requested range continues after a discovery,
- results publish progressively while the scan is still running,
- duplicate result URLs are suppressed,
- cancellation remains AbortController-based,
- invalid/incomplete input is tolerated while editing and validated when starting the scan.

Do not move scan lifecycle back into `ShellySetupPage.tsx`.

## Shelly setup page

`ShellySetupPage.tsx` still keeps transport/state implementation behind the narrow `ShellySetupFlow` contract. It does not directly own Shelly RPC or BLE transport, so it has not become a transport god object.

It has nevertheless accumulated four materially distinct presentation tasks:

1. Add Plug/manual entry,
2. LAN scan and progressive result selection,
3. settings for one concrete Plug,
4. Shelly-side BLE discovery and thermometer save.

The file is now about 810 lines and the repository gate reports 811 lines against a 700-line responsibility budget. This is a real presentation-composition regression, not just a cosmetic line-count issue.

The preferred cleanup is behavior-preserving extraction of cohesive modal/presentation units, for example Add/LAN-scan, concrete Plug settings and BLE-discovery content. Keep dialog intent in one discriminated page-level state and keep all mutations/lifecycle in the existing flows/hooks. Do not introduce a second setup store or new RPC layer.

## Sensor setup page

`SensorSetupPage.tsx` correctly delegates phone BLE/live-scan/GATT behavior to `usePhoneSensorFlow` and page lifecycle/feedback to `useSensorSetupFeedback`. The page itself does not create a scanner or own radio lifecycle.

The saved thermometer card has now become a distinct presentation responsibility: editable identity, source indicator, temperature/humidity metrics, battery/RSSI/last-seen strip, details disclosure and device actions. The file is about 690 lines and the repository gate reports 691 lines against a 650-line budget.

This is a justified seam for a focused `SavedSensorCard`-style component. The next thermometer leading-icon/live-sample polish should live at that card boundary rather than adding more event/presentation logic to the page.

### Fresh-sample semantics

`sensorReadingsStore.ts` is the single per-sensor reading source for both scan paths. It currently retains the merged latest sample for each normalized sensor ID. A genuinely new sample is therefore represented by a strictly newer `seenAtMs` for that sensor.

For the pending blue icon pulse:

- derive the event from `seenAtMs` advancing,
- do not pulse on mount, tab switch or ordinary rerender,
- do not use global `savedSensorLiveScanState.updatedAtMs` as per-sensor freshness,
- do not add a second freshness store/domain state.

A component-local transient animation mechanism is acceptable only as presentation; the timestamp in the existing readings store remains the semantic source of truth.

## Store boundaries

`setupDraftStore.ts` remains a setup/device draft store. The 2026-09-17 pass added optional Plug `model` + `gen` metadata but did not add automation ownership. Keep it that way.

The persisted rule fields in this store are setup-draft inputs, not the installed automation source of truth. Installed configuration belongs to `InstalledAutomation` after installation.

`sensorReadingsStore.ts` remains a separate ephemeral readings store. Both phone and Shelly-side discovery feed it through the existing ingestion path; do not create per-source copies.

## CSS and UI primitives

The current branch adds Plug/dashboard-specific styles and expands sensor/Shelly setup styling, but the audit did not find a compelling new shared primitive that must be created immediately. Header/icon/title patterns are similar but not yet identical enough to justify a broad abstraction.

For the pending thermometer icon, prefer existing design tokens and Tabler icons and reuse the established Plug-card spatial rhythm. Extract a shared primitive only if the implementation would otherwise duplicate the same semantic component in more than one place.

Remove empty selectors such as `.sensor-setup-panel {}` when touching the stylesheet, but do not perform a broad CSS rewrite during this pass.

## Test boundaries

Most new tests assert user-visible behavior, but several assertions are coupled to implementation classes, including `.status-stack`, `.sensor-setup-panel--embedded`, `.demo-panel`, and exact icon/class structure. These are useful for deliberate structural contracts in a few UX tests, but they should not become the default way to prove behavior.

When the affected tests are next edited:

- prefer roles, accessible names, visible state and RPC effects,
- keep class/DOM-shape assertions only for an intentional layout/design-system contract,
- keep the focused `useShellySetupScanFlow` tests protecting progressive publication and scan behavior.

Do not split large scenario tests merely to reduce file size.

## Current quality-gate state

The read-only 2026-09-17 audit ran `pnpm quality:repo`. It currently fails only the two hardware-setup composition budgets relevant to this pass:

- `ShellySetupPage.tsx`: 811 > 700,
- `SensorSetupPage.tsx`: 691 > 650.

The narrow flow budgets inspected in the same audit remain below their limits (`useHardwareSetupFlow` 586, scan 84, control 290, Shelly BLE 177, phone sensor 264).

Do not raise the budgets to hide this regression. Restore headroom by extracting the real presentation responsibilities described above, without behavior changes.

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

Architecture cleanup is complete only when its affected checks pass again; a docs-only audit does not claim a new release freeze or full `pnpm check:full` result.
