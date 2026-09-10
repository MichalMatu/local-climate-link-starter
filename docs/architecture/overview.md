# Architecture overview

## Purpose

Local Climate Link is a configurator and management UI for local BLE -> Shelly climate automations plus simple Shelly-native time automations. The phone handles setup, status, management and diagnostics; after setup, runtime ownership stays on the Shelly device.

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

UI copy uses a lightweight app-level i18n layer in
`apps/mobile/src/app/i18n.ts`. The default locale follows the system
browser/webview language and is applied to `document.documentElement.lang`.
Supported locales are Polish, English, German, Spanish, French, Italian, and
Brazilian Portuguese. Unsupported languages fall back to English, and generic
Portuguese tags resolve to `pt-BR`. The full-page Settings screen can override
the system locale; that preference is persisted locally and can be returned to
`system` at any time.

User-facing copy for the main setup path, safety states, validation errors,
Shelly errors, diagnostics, and demo flow must be added as typed keys under
`apps/mobile/src/app/locales/` and read through `t(...)` or `translate(...)`.
Locale tests enforce key parity between every registered locale and the Polish
source tree, then scan production UI code for hardcoded Polish strings.

To add another language, add a locale file with the same key shape, register it
in `supportedLocales` and `messages`, then run the i18n tests. Keep plural and
date/time formatting in small helpers near the UI that needs them.

Do not add a broad i18n dependency until external translation files, translator
workflows, or ICU-level message formatting become a real product requirement.

Vite/dev builds expose `window.lclDev` and a `/help` developer command menu for
local testing of locale overrides, theme modes, and runtime error capture. This
API must not become visible production UI.

## Current setup/runtime data flow

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

The current mobile shell is intent-first rather than setup-tab-first. With no
saved installation it opens the goal chooser; with installed automations it
opens the Dashboard. Dashboard, installation detail, and the full-page Settings
screen share the bottom navigation (`Klimat / Czas / Ustawienia`). Settings owns
locale, appearance, and progressively disclosed service diagnostics.

Installed climate automations use a persistent per-installation model binding a
stable app installation id to Shelly identity/address, script identity/hash,
sensor identity and rule configuration. Dashboard/detail runtime state is read
from the Shelly controller rather than silently substituting phone BLE data.
Pure time automation uses native Shelly schedules and must not compete with a
climate script for the same relay.

The hardware setup flow remains available for real local setup and diagnostics:
manual Shelly checks, bounded LAN scanning, phone BLE, Shelly-side temporary BLE
discovery, PVVX operations, generated-script installation, safe relay testing,
and recovery. The demo adapters remain for hardware-free development; they are
not the runtime architecture.

Shelly LAN discovery belongs to the hardware setup flow, not directly to React
components. The flow builds the IPv4 candidate list, removes already saved Shelly
base URLs, scans the remaining addresses with bounded concurrency, and returns
only verified `Shelly.GetDeviceInfo` candidates to the UI. The UI presents those
candidates as direct add actions.

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

## UI quality boundary

Mobile styling should use generated `--lcl-*` design tokens and shared classes.
Production mobile TSX must not introduce ad-hoc inline `style={{...}}` blocks or
hand-authored SVG icons; use real Tabler components for standard actions. The UX
quality gate enforces these rules together with tokenized colors, borders,
z-indexes, responsive behavior and modal sizing. `pnpm tokens:build` must remain
idempotent with no generated diff.

## Known refactor boundary

`ShellySetupPage` has been split so reusable/presentational Shelly formatting,
input UI and saved-device card rendering live in `ShellySetupPresentation.tsx`.
The remaining high-concentration seam is `useHardwareSetupFlow.ts`. It owns many
stateful hardware operations and safety-sensitive mutations, so it must not be
split merely to reduce file length. Future extractions should follow cohesive
runtime responsibilities while preserving the public flow contract and the
hardware regression suite. Preferred boundaries are:

```text
saved Shelly control/status mutations
Shelly BLE discovery session lifecycle
phone BLE live scan + PVVX GATT operations
installation/diagnostic orchestration
```

Do not mix such refactors with behavioral changes to relay safety, script
ownership, scan cleanup or installation verification.

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
