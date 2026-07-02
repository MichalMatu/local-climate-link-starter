# Implementation vertical slices

Implement in vertical slices. Each slice must compile, have tests, and leave the app in a usable state.

## Slice 0 — repository and tooling

Goal: deterministic repo foundation.

Deliver:

```text
pnpm workspace
root package.json commands
TypeScript strict configs
ESLint + Prettier
Vitest config
React Testing Library setup
Style Dictionary package skeleton
Ionic React + Capacitor app skeleton
README and ADRs
```

Acceptance:

```text
pnpm install
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

No BLE or Shelly hardware required.

## Slice 1 — demo setup wizard

Goal: app flow works without hardware.

Deliver screens:

```text
Start
Add sensor
Sensor live preview
Add Shelly
Shelly compatibility check
Heating rule wizard
Natural-language summary
Script preview
Install/fake upload
Safe relay test
Diagnostics
```

Deliver fake adapters:

```text
FakeBleScanner
FakeShellyClient
FakeStorageRepository
```

Acceptance:

```text
User can complete full demo flow.
Demo mode uses same interfaces as real mode.
No production component has demo-specific branches.
```

## Slice 2 — automation-core

Goal: pure deterministic thermostat engine.

Package: `packages/automation-core`

Deliver:

```text
ThermostatRule schema
AutomationInput
AutomationDecision
heating decision engine
stale timeout guard
min change guard
max ON guard
boot OFF behavior
simulator helpers
```

Acceptance tests:

```text
temp below threshold -> ON request
temp above threshold -> OFF request
inside hysteresis band -> keep state
stale sensor -> OFF request
boot/start -> OFF request
max ON exceeded -> OFF request
min change guard blocks chatter
```

All time values must be passed as `nowMs`. No hidden wall-clock reads inside pure functions.

## Slice 3 — BLE parsing fixtures

Goal: parse setup advertisements in TypeScript.

Package: `packages/ble-core`

Deliver:

```text
NormalizedBleAdvertisement
parseBthomeV2Advertisement
parseTp357Advertisement
fixture loader
malformed payload tests
```

Acceptance:

```text
BTHome temp/humidity/battery fixture passes.
TP357 MatrixHub manufacturer-data fixture passes.
Malformed payload returns typed error, not throw.
iOS unstable device IDs are handled as setup-only IDs.
```

Important: keep TP357 byte behavior aligned between `ble-core` and generated Shelly Script. Hardware support still needs dated Shelly-side validation in the hardware matrix.

## Slice 4 — Shelly Script generator

Goal: deterministic generated script from typed config.

Package: `packages/script-generator`

Deliver:

```text
ShellyThermostatConfig schema
normalizeConfig
configHash
generateShellyThermostatScript
snapshot tests
placeholder replacement tests
script size warning
```

Script must include:

```text
version header
config hash
CFG object
safe boot OFF
BLE scan start failure handling
sensor filtering
BTHome parse path
TP357 parse path only when profile requires it
stale timeout OFF
min change / anti-chatter
max ON guard
Switch.Set relay control
diagnostics variables/logs
```

Forbidden:

```text
default ON
remote code fetch
eval
global user JavaScript injection
unused parsers in V1 script
```

## Slice 5 — Shelly client with mocked transport

Goal: correct RPC request/response logic before real hardware.

Package: `packages/shelly-client`

Deliver:

```text
ShellyRpcTransport interface
FetchShellyRpcTransport
MockShellyRpcTransport
ShellyClient
Script install service
safe relay test service
Zod validators for supported responses
```

RPC methods:

```text
Shelly.GetDeviceInfo
Shelly.GetStatus
Script.List
Script.Create
Script.Stop
Script.PutCode
Script.SetConfig
Script.Start
Script.GetStatus
Switch.GetStatus
Switch.Set
```

Acceptance:

```text
timeouts tested
RPC error shape tested
script replacement stops existing running script
safe relay test always ends OFF
Matter-blocked state prevents upload
```

## Slice 6 — mobile integration

Goal: real UI composed from packages.

Deliver:

```text
flow hooks / state machines
TanStack Query wrappers for Shelly operations
Zustand setup draft store
storage repository
typed i18n strings for supported locales
loading/success/error/blocked states
```

Acceptance:

```text
Component tests cover main wizard states.
Matter ON blocked state shown.
Rule summary matches thresholds.
Safe relay test UI cannot leave ON after failure.
```

## Slice 7 — real BLE adapter

Goal: hardware scan behind interface.

Deliver:

```text
CapacitorBleScanner adapter
permission flow
scan start/stop lifecycle
scan result normalization
Android/iOS permission copy
platform-specific docs
```

Acceptance:

```text
Scans stop when screen unmounts.
UI scan stream is debounced.
Malformed scan data does not crash UI.
Diagnostic export redacts raw payloads by default.
```

## Slice 8 — real Shelly hardware validation

Goal: first end-to-end hardware proof.

Deliver:

```text
manual IP flow
Shelly RPC status check
script upload
script start
first reading wait
safe relay test
hardware diagnostics export
```

Acceptance on real hardware:

```text
Xiaomi BTHome v2 detected by app setup scan
Shelly Plug S Gen3 detected by manual IP
Matter ON blocks install
Matter OFF permits install
script starts on boot
relay turns ON below threshold
relay turns OFF above threshold
stale sensor turns relay OFF
power cycle starts safe OFF
```
