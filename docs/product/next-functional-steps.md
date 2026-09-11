# Local Climate Link — post-v2.0.10 product roadmap

Status: active product roadmap after the v2.0.10 runtime/detail/diagnostics tranche.

Current behavior-changing baseline:

```text
16d8627b9df050152a72f021e2ab3a228cffefb3
feat(mobile): add installation controls and diagnostics
```

This document is the canonical roadmap for the next product phase. `docs/plan.md`
remains historical MVP/design context; `docs/HANDOFF_NEXT_CHAT.md` carries the
short current continuation state.

## Implementation checkpoint — 2026-09-11 / v2.0.10

The following slices are implemented baseline, not future work:

- persistent per-installation identity/configuration,
- intent-first entry and installed-automation dashboard,
- stable per-installation detail management,
- shared `Klimat / Czas / Ustawienia` bottom navigation and full-page Settings,
- explicit AUTO/MANUAL plus MANUAL-only relay ON/OFF with exact-script safety checks,
- native Shelly schedule ownership for pure time automation,
- progressive disclosure for installation-scoped developer diagnostics,
- script/device resource diagnostics and 3-second modal-only auto-refresh,
- current-value-only climate UI; chart/history persistence was intentionally removed,
- completed physical-button validation preserving native momentary behavior.

The next agreed product slice is **expanded Shelly LED configuration**. Keep it
app-side through `PLUGS_UI`; do not re-open the stable climate runtime or add LED
logic to the generated thermostat script.

## Product direction## Product direction

Local Climate Link is no longer best described as only a thermostat. The stable
core already supports four climate-control modes:

- heating,
- cooling,
- humidifying,
- dehumidifying,

plus VPD-assisted threshold adjustment and safety guards such as stale-sensor
OFF, boot OFF, minimum-change protection, maximum ON time, RSSI filtering, and
consecutive-hit confirmation.

The next product direction is therefore:

> a simple local climate automation configurator that uses Shelly as the runtime
> controller and the phone as setup, status, and diagnostics UI.

The architectural promise does not change: once configured, automation must keep
working without the phone, cloud, Home Assistant, MQTT broker, or server.

## Non-negotiable rules for this roadmap

- `v2.0.9` is the rollback/reference point. Do not rewrite Stable Core v1 just to
  support the new UI.
- Keep the generated climate script small and safety-focused.
- Generated JavaScript is never the source of truth; typed configuration is.
- Keep phone BLE as setup/diagnostic input, not the runtime controller.
- Prefer native Shelly capabilities over adding unrelated logic to the climate
  script.
- Add one vertical slice at a time and keep the existing hardware matrix as the
  regression gate for runtime changes.
- No licensing, payments, Play Store work, phone-to-Shelly BLE RPC, new device
  families, or cloud features in this roadmap.

## Phase 0 — installation model before UX work

This is the main architectural issue found in the re-audit.

Today the app can remember multiple Shelly devices and sensors, but the active
rule fields are one global setup draft and some installation state is only held
in the current React flow. That is sufficient for the current configurator but
not for a dashboard or a reliable per-Shelly detail screen.

Before changing navigation, introduce one small persistent domain model for an
installed automation. It should bind at least:

```text
app installation id
Shelly identity + current connection address
Shelly script id/hash
sensor identity + runtime BLE address/profile
climate rule config
installation state/version
```

Use this model as the app-side source of truth for installed systems. Do not use
IP address, generated script text, current tab state, or the last setup draft as
installation identity.

Development data may be reset instead of adding migration complexity, consistent
with `AGENTS.md`.

### Gate

Do not build the new dashboard or per-Shelly screen until two independently
configured Shelly entries can retain different sensor/rule configurations in
app storage.

## 1. Better UX — start from user intent

Replace the technical top-level mental model:

```text
Shelly -> Sensor -> Rule -> Diagnostics
```

with a task-oriented entry point such as:

```text
What do you want to do?
- control temperature
- control humidity
- manage an existing automation
```

Heating/cooling and humidifying/dehumidifying remain presets inside the relevant
flow rather than primary navigation concepts.

Do not force an already configured user through the setup wizard on every app
launch. New users should enter setup; existing users should land on their
systems/dashboard.

Keep the current working setup operations and adapters. This phase is an
information-architecture and composition change, not a rewrite of BLE, Shelly
RPC, or script generation.

### Re-audit warning

The current setup pages are already large. Avoid replacing them with one new
large wizard component. Extract small presentational steps and keep orchestration
in the flow layer.

## 2. Simple dashboard after configuration

The dashboard should answer only the questions a normal user has after setup:

```text
What is the climate now?
Is the automation working?
Is the output ON or OFF?
What is the configured target/range?
Is the sensor fresh and reachable?
```

Primary values:

- temperature,
- humidity,
- VPD when both measurements are available,
- relay state,
- automation mode,
- target/range,
- simple health/freshness state.

For an installed system, prefer the Shelly runtime diagnostic snapshot as the
live source for temperature/humidity/VPD/relay decision. Do not silently mix a
phone BLE reading with a Shelly runtime reading and present them as one state.
Phone BLE remains useful during setup and sensor-specific history work, but the
runtime dashboard should describe what the controller itself currently sees.

Show offline/stale states explicitly instead of displaying old values as if they
were live.

## 3. Hide advanced options without hiding safety

Use progressive disclosure with three levels:

```text
Normal
Advanced
Developer diagnostics
```

Normal should contain the mode, target/range, current status, and the controls a
normal user changes.

Advanced can contain safety tuning such as RSSI threshold, stale timeout,
minimum change interval, maximum ON time, and VPD target. Keep safe defaults and
plain-language descriptions; these settings must remain accessible because they
change runtime behavior.

Developer diagnostics can contain script ID/hash, raw decision reason, firmware,
runtime memory, RPC details, and low-level diagnostic fields.

Do not equate "hide" with "delete". The goal is a calm default UI while keeping
support/recovery information available.

## 4. Expand from climate preset to local automation configurator

Keep the existing four climate modes and VPD support as the first automation
family. Do not generalize Stable Core v1 into a large generic rule engine before
there is a concrete use case.

The next automation family may be simple time control, for example a lamp that
is ON from 08:00 to 20:00. Prefer native Shelly schedules for pure time-based
ON/OFF automation so the climate script does not grow.

### Relay ownership rule

A single relay must have one clear owner. Do not create a climate script and an
independent schedule that both call `Switch.Set` on the same relay without an
explicit combined-control design.

Therefore distinguish:

```text
climate automation -> generated local climate script
pure time automation -> native Shelly Schedule
combined time + climate -> separate future design/gate
```

This avoids nondeterministic fights between two controllers and protects the
Stable Core v1 safety model.

VPD must also remain described accurately: current VPD assist adjusts the active
control thresholds using temperature/humidity; it is not a separate multi-output
VPD controller.

## 5. Shelly LED and physical button

Treat LED and button work as two separate capabilities.

### LED — next vertical slice

Shelly Plug S Gen3 exposes `PLUGS_UI` device configuration. The repository already
has a working typed client and a basic installation-detail card, so this is now an
incremental UX/capability expansion rather than a new subsystem.

Current code state:

- `RpcShellyPlugsUiClient` reads/writes `PLUGS_UI`,
- typed validation already covers modes `power`, `switch`, and `off`,
- typed patches already support arbitrary relay ON/OFF RGB + brightness and
  power-mode brightness,
- `ShellyLedSettingsCard` displays the confirmed current mode/configuration,
- `deviceLed.ts` currently narrows writes to two presets: `relay-state` and `off`.

Next implementation:

1. keep the existing client and query path; do not create a second LED backend,
2. expand the installation-level wrapper from preset-only writes to a typed editable
   configuration,
3. expose mode selection (`switch`, `power`, `off`),
4. in switch mode expose relay ON color + brightness and relay OFF color + brightness,
5. in power mode expose brightness only,
6. re-read `PLUGS_UI.GetConfig` after every write and render the confirmed device state,
7. retain a compact relay-state preset only if it remains a useful shortcut rather than
   becoming a parallel state model,
8. keep unsupported firmware graceful and do not invent fallback values,
9. add focused client/flow/UI tests, responsive E2E coverage, then a real Plug S Gen3
   smoke test.

Keep LED configuration separate from automation health. Do not infer script health from
LED color and do not add dynamic RSSI/battery/error flashing in this slice. Night-mode
configuration is also a separate follow-up unless a dedicated capability/schema audit
explicitly brings it into scope.

### Button — hardware validation complete### Button — hardware validation complete

Real-hardware validation was completed on 2026-09-09 with Shelly Plug S Gen3
model `S3PL-00112EU`, firmware `1.7.5` (test device `192.168.0.16`), and
`PLUGS_UI.controls["switch:0"].in_mode = "momentary"`.

Hardware/RPC proof:

- `Button.GetConfig id=0` and `Button.GetStatus id=0` both returned
  `Argument 'id', value 0 not found`, so there is no physical `button:0`
  component on this device; the generic `Button.*` RPC namespace must not be
  treated as proof of one,
- a passive V2 websocket listener on `ws://192.168.0.16/rpc` opened correctly
  with `write=False` and made no configuration changes,
- a real physical press produced `NotifyStatus` updates with
  `switch:0.output=true, source:"button"` and later
  `switch:0.output=false, source:"button"`,
- no separate button `NotifyEvent` was observed in that run,
- the listener exited cleanly; its Local Agent claim was released and the agent
  returned to IDLE.

The physical-button experiment is therefore DONE. Preserve native `momentary`
behavior: do not set detached mode, do not implement long-press pause/stop, do
not take ownership of the physical button, and do not change
`PLUGS_UI.controls["switch:0"].in_mode`. `source:"button"` may be used for
diagnostics. No further user button test is required without a new justified
hardware gate.

This keeps manual relay control predictable, avoids spending script/UI budget on
an event path the tested device does not expose separately, and leaves Stable
Core v1 unchanged.

## 6. Dedicated screen for every Shelly / installed system

After Phase 0, add a stable detail route for each installed system rather than
making the old setup tabs the permanent management UI.

The detail screen should contain:

```text
current climate + VPD
relay/output state
assigned sensor
active automation and target/range
automation pause/resume or edit entry point
simple health state
advanced settings
diagnostics
later: supported schedules
```

Use an app-side stable installation/device ID for routing. IP address is a
connection property and may change.

The dashboard should be a summary/list; this detail screen is where device-level
management belongs.

## Implementation order

Completed baseline:

1. persistent per-installation model,
2. intent-first UX shell and navigation,
3. dashboard backed by installed-system/runtime state,
4. per-installation detail screen,
5. progressive disclosure and scoped developer diagnostics,
6. first automation expansion using native Shelly schedules,
7. physical-button hardware validation with native momentary behavior preserved.

Next:

8. expanded Shelly LED configuration through `PLUGS_UI`, using the existing client and
   installation detail without changing the climate runtime.

After LED configuration is stable, re-audit the remaining product roadmap from actual
user/hardware evidence instead of carrying old speculative TODOs forward.

## Main risks caught before implementation## Main risks caught before implementation

### 1. Global setup draft is not a multi-installation model

Fix this first or settings from one Shelly can become the apparent settings of
another device in the new UI.

### 2. Multiple relay controllers can conflict

A native schedule and climate script must not independently own the same relay.
Define ownership before adding schedules.

### 3. Dashboard can accidentally have two truths

Phone BLE and Shelly runtime may see different packet ages/RSSI/readings. Use the
Shelly runtime as the primary installed-system status source.

### 4. LED capability should stay device-native

The client already supports static `PLUGS_UI` mode/color/brightness configuration; the
current app wrapper is simply narrower than that capability. Expand the UI/wrapper,
not the thermostat runtime. Dynamic error flashes and night-mode behavior remain
separate experiments until explicitly audited and tested on hardware.

### 5. Physical button is intentionally native-only on Plug S Gen3### 5. Physical button is intentionally native-only on Plug S Gen3

The firmware `1.7.5` hardware test did not expose a separate `button:0` component
or a separate button `NotifyEvent`; websocket relay updates carried
`source:"button"`. Preserve native `momentary` behavior instead of adding
detached-mode or long-press automation semantics.

### 6. UI refactor can become a big-bang rewrite

The current setup pages already contain substantial behavior. Preserve tested
flows and move one vertical slice at a time.

### 7. Script budget remains a hard boundary

UI, schedules, LED configuration, and management features should live outside
the generated climate script unless runtime-local climate logic truly requires
otherwise.

## Definition of success for this roadmap

At the end of this phase, a user should be able to open Local Climate Link and
understand the system without knowing what a Shelly Script, RSSI threshold, or
script ID is; configure or inspect more than one independent Shelly system
without settings leaking between them; see the state that the Shelly controller
itself is using; and still retain the offline, local, fail-safe behavior frozen
in `v2.0.9`.
