# Architecture overview

## Purpose

Local Climate Link is a configurator for local BLE -> Shelly automations. The app helps the user set up a sensor and a Shelly Plug S Gen3 once. After setup, the Shelly Script is the runtime controller.

## Runtime boundary

```text
Setup/runtime split:

Phone app
  - scans BLE for setup UX
  - validates sensor/output compatibility
  - records the Shelly-side sensor runtime address
  - builds typed JSON config
  - generates Shelly Script
  - uploads script over local Shelly RPC
  - runs safe relay test
  - shows diagnostics and recovery

Shelly Plug S Gen3
  - scans BLE during runtime
  - filters advertisements by runtime address and RSSI
  - parses BTHome/TP357 payloads
  - applies thermostat decision logic
  - controls switch:0 locally through Switch.Set
  - fails safe OFF on stale sensor/boot/max-on timeout
```

The phone must not be required for automation after setup.

## Package responsibilities

```text
apps/mobile
  UI, routing, flow orchestration, permissions, demo adapters

packages/ble-core
  BLE scanner interfaces, normalized advertisement model, pure parser functions, fixtures

packages/device-profiles
  sensor/output profiles, Zod schemas, compatibility metadata

packages/automation-core
  pure thermostat/humidistat/failsafe logic and simulator helpers

packages/shelly-client
  typed local RPC client, script upload flow, safe relay test, status checks

packages/script-generator
  deterministic Shelly Script generator from typed JSON config

packages/design-tokens
  token source and generated CSS/TS outputs

packages/ui
  reusable presentational components only

packages/diagnostics
  structured logs, redaction, diagnostic export
```

## Dependency rule

Domain packages cannot import React, Ionic, Capacitor UI components, or app-specific state. React screens compose use-case hooks and package APIs; they do not contain parser, automation, or Shelly RPC logic.

## UI copy and localization

MVP UI copy uses a lightweight app-level i18n layer in
`apps/mobile/src/app/i18n.ts`. The default locale is Polish. User-facing copy for
the main setup path, safety states, validation errors, Shelly errors, and demo
flow should be added as typed keys and read through `t(...)`.

Do not add a broad i18n dependency until there is a product requirement for
multiple runtime locales, language switching, pluralization rules, or external
translation files.

## Data flow for MVP setup

```text
1. User starts setup wizard.
2. App adapter returns demo or real BLE scan results.
3. ble-core normalizes advertisements and parsers emit Measurement objects.
4. device-profiles identifies compatible sensor/output profiles.
5. User selects a threshold rule mode: heating, cooling, humidifying, or dehumidifying.
6. User can optionally enable VPD assist; configured thresholds stay the safe limits.
7. automation-core validates and simulates the threshold rule with effective VPD-assisted thresholds when enough sensor data is available.
8. script-generator validates thresholds and creates Shelly Script from JSON config.
9. shelly-client backs up/reuses the existing Local Climate Link script, uploads code in chunks, enables run-on-boot, starts the script, and verifies status.
10. App runs safe relay test and stores setup draft locally.
11. Diagnostics panel displays status, runtime address, effective thresholds, and recovery actions.
```

## Current implementation boundary

Slice 0 and Slice 1 are implemented as a hardware-free demo flow:

```text
apps/mobile
  uses fake Xiaomi and fake TP357 readings
  uses FakeShellyClient for upload and relay test
  shows generated Shelly Script preview
  shows Matter ON blocked state only when the explicit demo scenario is enabled
  shows the simulated Shelly runtime address in diagnostics
  exports diagnostics summary
```

The demo path does not run real LAN scans, real relay commands, or real BLE runtime
discovery. The hardware setup flow is no longer demo-only: it can use local
Shelly RPC for manual IP checks, LAN scanning, script upload, diagnostics, and a
temporary Shelly-side BLE discovery script.

Real platform and Shelly access stay behind interfaces:

```text
packages/ble-core
  BleScanner port
  DemoBleScanner
  CapacitorBleScanner shell

packages/shelly-client
  ShellyClient port
  FetchShellyRpcTransport
  RpcShellyClient
  FakeShellyClient
```

Shelly-side BLE discovery is deliberately separate from runtime automation. The
app uploads `Local Climate Link BLE Discovery` as a temporary script, sets the
relay OFF before scanning, stops the main automation while discovery runs, polls
`/script/<id>/ble-scan`, and stops the discovery script when the modal closes.
If the automation script was running before discovery, the app starts it again
after the scan is closed.

## Safety boundary

For heating:

```text
boot -> OFF
sensor stale -> OFF
max ON exceeded -> OFF
manual stop -> OFF
failed relay test -> OFF
script upload failure -> OFF
invalid threshold config -> no script preview/install
```

Never weaken this in UI, automation-core, or generated Shelly Script.
