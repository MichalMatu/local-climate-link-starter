# Local Climate Link — current MVP plan

Status: MVP `1.0.0` test candidate plan for this repository.

This file describes the current direction. Detailed contracts live in
`AGENTS.md`, vertical-slice history in `docs/implementation/vertical-slices.md`,
and architectural decisions in `docs/adr/`.

## Product promise

```text
Termostat bez huba.
Termometr BLE + gniazdko Shelly.
Konfigurujesz raz w aplikacji, działa lokalnie.
```

The app configures the system once. Runtime automation belongs on the Shelly
device, not on the phone, cloud, MQTT broker, Home Assistant, or a local server.

## Current MVP boundary

Supported path:

```text
Xiaomi LYWSD03MMC / PVVX / unencrypted BTHome v2
or TP357 custom BLE beacon
        ↓
Ionic React + Capacitor app
        ↓
Shelly Plug S Gen3 on stock firmware
        ↓
generated local Shelly Script
        ↓
Switch.Set relay control
```

Rule presets exist for temperature and humidity control: heating, cooling,
humidifying, and dehumidifying. Hardware validation still prioritizes the
Shelly-first heating path.

Out of scope for MVP:

- phone background automation,
- cloud or telemetry by default,
- Home Assistant or MQTT as a requirement,
- Tasmota/NOUS before the Shelly path is stable,
- flashing Shelly firmware,
- user-facing JavaScript editing,
- broad random-device compatibility.

## Current implementation

Already present in the codebase:

- pnpm workspace with TypeScript, ESLint, Prettier, Vitest, Playwright, and
  design-token checks,
- package split for BLE, profiles, automation core, Shelly client, script
  generation, diagnostics, UI, and design tokens,
- web/mobile setup UI with Shelly, thermometer, rule, and diagnostics pages,
- demo path with fake BLE and fake Shelly adapters,
- BTHome v2 and TP357 parsers with fixtures,
- deterministic automation core with safety guards,
- Shelly RPC client, script install service, fake transport, and safe relay
  test path,
- throttled Shelly mutating RPC calls for scripts and relay changes, plus
  best-effort cleanup for temporary BLE helper scripts,
- minimal generated Shelly runtime scripts with profile-specific parser paths,
  config hash, compact diagnostics, Shelly clock, plug telemetry, stale OFF,
  boot OFF, BLE start retry after reboot, min-change guard, and max-ON guard,
- temporary Shelly-side BLE discovery script named
  `Local Climate Link BLE Discovery`,
- diagnostics view that reads compact `/script/<id>/diag` metadata from the
  installed script, including read-only Shelly clock status, script hash/running
  state, plug telemetry, and readable decision reasons.
- long-running Shelly soak logger for background hardware stability checks, with
  JSONL samples, Markdown summaries, and an optional threshold-cycling mode that
  exercises real relay ON/OFF transitions through the generated runtime rule.

The current MVP path is ready for user hardware testing. The latest dated
Shelly Plug S Gen3 audit and full runtime matrix are recorded in
`docs/testing/hardware-matrix.md`. This does not expand the support promise
beyond the documented Xiaomi/PVVX BTHome v2, TP357, and Shelly Plug S Gen3 path.

## Runtime architecture

```text
Phone setup scan
        ↓
Shelly-side BLE confirmation
        ↓
typed JSON config
        ↓
deterministic Shelly Script
        ↓
local BLE scan + relay decisions on Shelly
```

Phone BLE scanning is setup UX only. On iOS, phone scan IDs must be treated as
unstable until the Shelly-side scanner confirms the runtime address.

Generated scripts must stay small. Upload chunking does not solve Shelly runtime
memory limits, so script-size budgets stay enforced by tests.

## Safety rules

Default safety behavior:

```text
boot/start      -> relay OFF
stale sensor    -> relay OFF
max ON exceeded -> relay OFF
scan failure    -> relay OFF
manual recovery -> OFF first, then normal auto evaluation
```

The app must never leave a relay test ON after failure. The user has granted
standing authorization for local development smoke tests to toggle the Shelly
relay without separate approval each time. Local Climate Link development
scripts on local hardware are disposable when the user explicitly authorizes
hardware actions.

## Active priorities

1. Run user-facing hardware tests on the documented MVP path.
2. Repeat the full Shelly hardware path after runtime or firmware changes.
3. Keep generated scripts minimal and profile-specific.
4. Keep diagnostics compact, readable, and useful for support.
5. Keep reducing UI noise only where it improves setup speed or safety.
6. Avoid adding new device families until Xiaomi/PVVX, TP357, and Shelly are
   stable end to end.

## Planned app extensions

### Sensor history and charts

The current Xiaomi/PVVX chart preload reads the latest saved memo samples by
count, not by a user-facing time window. The first implementation reads 50
samples, so the visible time span depends on the thermometer's configured memo
recording interval.

Planned improvements:

- Make the history window explicit in the app, for example recent readings,
  24 hours, 7 days, or all available PVVX memo records within a safe limit.
- Store fetched Xiaomi/PVVX history locally per sensor, keyed by stable sensor
  identity plus sample timestamp/index, so the app does not download and append
  the same records repeatedly.
- Add incremental sync: after the first full preload, fetch only newer records
  where the PVVX protocol and device state allow it. If index-based incremental
  reads are unreliable, deduplicate locally and keep the UI honest about the
  refresh result.
- Merge downloaded Xiaomi/PVVX history with live phone BLE packets, preserving
  source metadata and avoiding duplicate chart points.
- Replace the compact in-card sparklines with a proper chart modal when enough
  data exists. The modal should support larger time ranges, clear axes/units,
  temperature, humidity, battery/voltage where available, and later VPD derived
  from temperature and humidity.
- Keep the compact sensor cards focused on current readings and a small preview.
  Detailed analysis belongs in the chart modal.

### TP357 chart path

TP357 support currently relies on live BLE packets and locally stored readings.
Unlike Xiaomi/PVVX, the app does not yet have a confirmed TP357 history download
path.

Planned improvements:

- Research and validate whether stock TP357 firmware exposes stored history over
  BLE GATT in a way compatible with our app and licensing rules.
- If stock TP357 history is not practical, keep TP357 charts based on phone-captured
  rolling history from live packets, with clear UX that only readings seen by the
  app are available.
- If a custom TP357 firmware path becomes part of the product, document it as a
  separate profile and keep parser/history logic separate from Xiaomi/PVVX.
- Add tests for TP357 chart persistence, deduplication, and stale/live packet
  merging before presenting TP357 charts as a reliable historical feature.

### Setup health checks and reliability testing

The app should give users a clear answer to "is my setup actually working?"
without requiring them to understand BLE packets, Shelly scripts, RSSI, or
diagnostic payloads. This should be a user-facing feature, not only an internal
developer test.

Planned improvements:

- Add a one-tap setup health check after configuration. It should verify that
  the phone can see the thermometer, Shelly can see the runtime BLE address, the
  generated script is installed and running, the config hash matches, and relay
  `OFF -> ON -> OFF` works.
- Keep the health check safe by always ending with a known relay state and
  showing the final state explicitly.
- Show a compact result summary with OK, warning, and blocked rows, for example
  sensor seen by phone, sensor seen by Shelly, script running, relay test,
  signal quality, last reading age, and current rule decision.
- Add a short reliability test mode that observes a sensor for 10-15 minutes and
  reports packet count, longest packet gap, average RSSI, worst RSSI, stale
  periods, and whether the placement looks reliable enough.
- Store reliability test results locally so support can compare "before" and
  "after" when the user moves the thermometer or Shelly plug.
- Feed health-check and reliability results into the support report so a user
  can share actionable diagnostics instead of saying only that the app "does not
  work".
- Add demo fixtures for good, weak, stale, and mismatched setups so this flow can
  be tested without hardware.
- Add automated tests for result classification and UI states, plus a manual
  hardware checklist for real Shelly relay transitions and signal-quality
  scoring.

## Known validation gaps

- Xiaomi/PVVX and TP357 need repeated dated checks on real Shelly hardware.
- Stale-sensor and max-ON behavior need hardware confirmation after the latest
  runtime changes.
- iOS BLE identity behavior must remain documented as setup-only until the
  native iOS project, `Info.plist` strings, and real iPhone flow are complete.
- Native mobile permission behavior and store disclosures need release-candidate
  validation beyond the web preview. Track the final checklist in
  `docs/release/store-readiness.md`.

## Checks

Use narrow checks while iterating. Before shipping meaningful code changes, run:

```text
pnpm format:check
pnpm lint
pnpm quality:ux
pnpm typecheck
pnpm test
pnpm build
```

Run `pnpm e2e:responsive` when layout, routing, or browser-visible UI changed.
