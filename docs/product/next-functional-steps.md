# Local Climate Link — next functional steps

Updated: 2026-09-17

This is the current product roadmap after the Plug/Thermometer navigation and management pass on `work/plug-screen-automation-entry-20260917`.

The last product-code SHA built and installed on the physical Samsung S22+ is:

```text
19bbd0ccf87f5490a216ca4ec302acf9c5b5a7ac
Compact thermometer card details
```

The later `8b5044cb7d653f38681c8c12315ff9ad593ba256` commit is documentation-only handoff state.

## Current product model

The primary mental model is:

```text
physical Plug -> control method / installed automation
```

Keep these accepted decisions:

- bottom navigation is **Plugs | Thermometers | Settings**,
- `+` on Plugs adds a physical Plug,
- automation setup starts from a concrete Plug and keeps that Plug context,
- Time is a Plug automation type, not a global dashboard section,
- `InstalledAutomation` remains the durable automation entity,
- an unconfigured saved Plug remains useful for live telemetry, direct relay control and later automation assignment,
- both phone BLE and Shelly-side BLE discovery save thermometers into the same sensor store,
- user display name is separate from hardware identity (`model` + `gen`),
- no independent global Rules/ownership surface is planned without a concrete requirement.

Future Plug-family support should build on stored hardware identity rather than hard-coded `Plug S Gen3` labels or user names.

## Current dashboard state

### Plugs

A physical Plug is the main dashboard entity.

A plain Plug card currently provides:

- editable user name,
- live power/voltage/energy/time,
- direct ON/OFF,
- physical-device settings,
- `Dodaj automatykę`.

A Plug with an installed climate/time automation renders the corresponding installed-automation card and uses the `InstalledAutomation` runtime/status path.

Concrete Plug settings currently show model/gen + compatibility, address, firmware, Wi-Fi RSSI, uptime, NTP sync/timestamp, Scripts, Bluetooth and Matter. They also expose Shelly-side BLE thermometer discovery and app-only Plug removal.

### Thermometers

Thermometers are a first-class bottom-navigation surface. Saved cards show:

- editable user name,
- latest temperature and humidity,
- battery/voltage, RSSI and last reading time,
- latest reading source icon,
- Details disclosure with type and MAC.

Phone BLE and Shelly-side discovery converge on the same saved sensor/readings model.

## Immediate architecture hygiene before more feature work

The 2026-09-17 read-only re-audit found two concrete composition regressions and one older duplicate control path.

### 1. Restore repository architecture gate

`pnpm quality:repo` currently fails because:

- `ShellySetupPage.tsx` is 811 lines against a 700-line budget,
- `SensorSetupPage.tsx` is 691 lines against a 650-line budget.

Do not raise the budgets. Use the real presentation seams already present:

- extract cohesive Shelly Add/LAN-scan, concrete settings and/or BLE-discovery presentation units while keeping the existing `ShellySetupFlow`,
- extract the saved thermometer card presentation from `SensorSetupPage` while keeping phone BLE/lifecycle in the existing flows/hooks.

These are behavior-preserving cleanup tasks, not a redesign.

### 2. Retire the legacy generic Shelly AUTO/MANUAL path

The installed climate runtime correctly changes AUTO/MANUAL inside the running managed script with exact installation checks. Generic hardware setup still exposes an older `useShellyControlFlow` AUTO/MANUAL path that uses `Script.Start` / `Script.Stop` through `SavedShellyDeviceCard`.

Do not build new management features on that path. Narrow generic Shelly control to physical status/direct relay control and keep installed automation control in `flows/installations/*`. Preserve temporary stop/restart behavior that is specifically part of Shelly BLE-discovery cleanup.

This cleanup should be handled deliberately because it changes which legacy setup controls remain visible; do not mix it into a visual-only thermometer change.

## Next small UX slice

After the architecture audit/cleanup boundary is accepted, the next already-agreed UX item is the thermometer card header.

Implement only this small slice:

- add a Tabler thermometer/temperature icon at the upper-left,
- align icon/name/actions with the spatial rhythm of Plug cards,
- when a genuinely newer BLE sample arrives, allow the icon to turn blue briefly and then return to normal,
- define “new” as the sensor's existing latest sample `seenAtMs` strictly advancing,
- do not trigger from mount, rerender, tab switch or global scan lifecycle,
- do not create another sensor store or second freshness domain state.

The existing readings store is the semantic source of truth. Any transient pulse mechanism is presentation-only.

## Automation ownership rules

### Climate

Climate automation remains the generated local climate runtime with the accepted safety model.

AUTO/MANUAL invariants:

- the exact managed script remains running in AUTO and MANUAL,
- MANUAL blocks automatic output decisions inside the runtime,
- relay is forced/verified OFF during mode transition as already implemented,
- direct ON/OFF requires verified MANUAL ownership/capability.

### Time

Pure time automation belongs to a concrete Plug and uses native Shelly Schedule. It is not a global Time surface.

Keep one relay owner. Do not let a climate script and independent native schedule both drive the same relay without a separately designed combined-control model.

### Durable entity

`InstalledAutomation` remains the authoritative installed automation record. Do not infer ownership from setup draft selection, IP address, generated script text or a new global registry.

## Sensor rules

- phone BLE is setup/live-reading input, not the autonomous runtime controller,
- Shelly-side BLE discovery uses the existing temporary discovery flow and saves into the same sensor store,
- sample source may differ, but there is one per-sensor readings store,
- MAC remains available under Details because it is useful for identification/debugging and future assignment,
- do not add a second “freshness” model for UI animation.

## Deferred product work

These remain valid later candidates, not the immediate next slice:

- expanded Shelly `PLUGS_UI` LED configuration,
- additional Plug hardware families after capability/hardware-identity audit,
- richer thermometer management only when a concrete workflow requires it,
- combined time + climate control only after an explicit relay-ownership design,
- VPD algorithm changes only in a dedicated runtime/algorithm audit.

Do not reopen stable climate runtime code for unrelated device/UI work.

## Development order

Current order is:

1. keep this architecture/product documentation current,
2. restore `quality:repo` headroom through the two justified presentation extractions,
3. resolve/narrow the legacy duplicate generic Shelly AUTO/MANUAL path separately,
4. implement the small thermometer leading-icon/new-sample pulse slice,
5. run focused mobile tests, build, `pnpm quality:ux`, `pnpm quality:repo`, `git diff --check` and broader checks appropriate to the touched scope,
6. install on the physical S22+ and visually verify when the UX slice is ready,
7. only then choose the next product feature from current evidence.

Do not claim a new release baseline until the full required gate and physical QA are actually rerun.
