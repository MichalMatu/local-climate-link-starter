# Local Climate Link — post-v2.0.9 product roadmap

Status: audited implementation plan after `v2.0.9` / **Stable Core v1**.

Baseline commit:

```text
b44899ba66b202ca05f48a8856a9871daee97832
```

This document is the canonical roadmap for the next product phase. It narrows the
older broad extension list to the work that should happen before commercial
packaging. `docs/plan.md` remains the MVP/history document.

## Product direction

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

### LED — safe first step

Shelly Plug S Gen3 officially exposes `PLUGS_UI` configuration with `power`,
`switch`, and `off` LED modes plus configurable RGB/brightness for relay ON/OFF.
Start with app-side device configuration, not additional thermostat runtime
logic.

Useful first version:

- configure a predictable relay ON/OFF indication,
- optionally disable the LED,
- expose current LED mode in device settings/diagnostics.

Do not promise dynamic flashing for low sensor battery, weak RSSI, or arbitrary
runtime errors until a real-device test proves that repeated runtime LED control
is practical and does not harm script size, memory, or reliability.

### Button — hardware validation complete

Real-hardware validation was completed on 2026-09-09 with Shelly Plug S Gen3
firmware `1.7.5` and `PLUGS_UI` `switch:0` configured with
`in_mode=momentary`.

Observed behavior:

- there is no separate `button:0` component,
- a physical press produced websocket output updates with
  `output:true source:"button"` and `output:false source:"button"`,
- no separate `NotifyEvent` for the button was observed in the validation run.

The product decision is therefore to preserve the native momentary button
behavior. Do not switch the device to detached input mode and do not add a
long-press pause/stop feature. Treat the physical button as native Shelly relay
control rather than as a script-visible automation command surface.

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

Use this sequence:

1. Phase 0: persistent per-installation model.
2. Intent-first UX shell and navigation.
3. Dashboard backed by installed-system/runtime state.
4. Per-Shelly / per-installation detail screen.
5. Progressive disclosure of advanced and developer diagnostics.
6. First automation expansion using native Shelly capabilities where possible.
7. LED configuration.
8. Physical-button hardware validation: complete; keep native momentary behavior
   with no detached mode or long-press pause.

The numbered product goals remain the six goals above; Phase 0 is an enabling
architecture change, not an additional product feature.

## Main risks caught before implementation

### 1. Global setup draft is not a multi-installation model

Fix this first or settings from one Shelly can become the apparent settings of
another device in the new UI.

### 2. Multiple relay controllers can conflict

A native schedule and climate script must not independently own the same relay.
Define ownership before adding schedules.

### 3. Dashboard can accidentally have two truths

Phone BLE and Shelly runtime may see different packet ages/RSSI/readings. Use the
Shelly runtime as the primary installed-system status source.

### 4. LED capability is narrower than the original idea

Static relay-based RGB indication is documented. Arbitrary dynamic error flashes
are a separate experiment, not a guaranteed feature.

### 5. Physical button is intentionally native-only on Plug S Gen3

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
