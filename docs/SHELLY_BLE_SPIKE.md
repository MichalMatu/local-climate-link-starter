# Shelly RPC over BLE — spike plan and lab journal

Status: active experimental plan on `work/shelly-ble-transport`

Date started: 2026-09-25

This is a working branch document for the hardware-first Shelly RPC-over-BLE spike. It combines the implementation mini-design, experiment plan and dated lab journal so evidence is kept in one place during the spike. If the spike becomes a supported product capability, durable conclusions should be folded back into the canonical architecture/roadmap/hardware-matrix docs and this working document may be removed.

## Goal

Prove that Shelly Link can manage a Shelly Plug S Gen3 through BLE RPC while preserving the existing product, identity, safety and automation ownership model.

The first slice is intentionally narrow:

1. discover Shelly devices over phone/Mac BLE;
2. connect to a specific physical Plug;
3. verify identity with `Shelly.GetDeviceInfo`;
4. prove read-only status RPC;
5. later prove safe relay control `OFF -> ON -> OFF` with an explicit final OFF verification;
6. only after that consider broader management or script lifecycle support.

Climate/script install lifecycle is out of scope for the first spike.

## Architecture gate

```text
product owner      -> Plug management
state owner        -> existing Plug / InstalledAutomation state
side-effect owner  -> Shelly RPC transport + narrow platform BLE GATT adapter
UI owner           -> none for the first feasibility spike
final file layout  -> packages/shelly-client/src/rpc/ble*.ts
                      apps/mobile/src/platform/shellyBleTransport.ts
                      focused package/mobile tests
test owner         -> shelly-client protocol/transport tests
                      mobile adapter tests
                      real Mac + S22 + Plug S Gen3 hardware evidence
```

Rules:

- BLE is a transport adapter, not a second product model.
- `Shelly.GetDeviceInfo.id` remains physical identity; IP, BLE advertisement name and CoreBluetooth UUID are transport identifiers only.
- HTTP remains the baseline and must not regress.
- No screen owns raw BLE/GATT or RPC framing.
- No new production dependency is required for the planned app implementation.
- Do not repeat an ambiguous mutating RPC automatically after timeout/disconnect.
- Hardware relay acceptance must finish with a verified OFF state.

## Transport mini-design

The package-level BLE transport will implement the existing `ShellyRpcTransport` contract.

Proposed shape:

```text
BleShellyRpcTransport
  -> injected narrow GATT port
      connect
      disconnect
      read
      write
  -> BLE RPC framing/codec
  -> existing RpcShellyClient/domain callers
```

Planned files:

```text
packages/shelly-client/src/rpc/bleProtocol.ts
packages/shelly-client/src/rpc/ble.ts
packages/shelly-client/src/__tests__/bleProtocol.test.ts
packages/shelly-client/src/__tests__/ble.test.ts
apps/mobile/src/platform/shellyBleTransport.ts
```

The transport should serialize requests per connection. One RPC owns the control/data channel until its response has been fully consumed.

### Planned RPC sequence

```text
request object
-> assign request id
-> JSON UTF-8 bytes
-> write 4-byte big-endian request length to TX control
-> write request bytes to data characteristic
-> poll/read RX control until response length is available
-> read data characteristic chunks until exact response byte count is collected
-> decode UTF-8 JSON
-> verify/match response id where available
-> map result/error into existing Result<T>
```

Timeout, abort, malformed framing, disconnect and invalid JSON are transport failures. After a mid-frame failure the connection should be considered suspect and closed before another RPC.

## Hardware test matrix for the spike

Two physical Plug S Gen3 units are intentionally used.

### Plug A — existing configured development Plug

Expected state:

- already known to Shelly Link;
- connected to home Wi-Fi;
- existing Shelly Link-managed script/automation present;
- established physical identity available from previous testing.

Purpose:

- verify BLE management works on an already configured real device;
- observe bonding/pairing requirements outside initial provisioning;
- compare BLE `GetDeviceInfo` identity with the stored physical Plug identity;
- later test read-only status and controlled relay transition;
- do not alter the existing script during the first spike.

### Plug B — factory-fresh Plug

Expected state:

- newly removed from the box;
- powered but otherwise unconfigured;
- no home Wi-Fi configuration;
- initial/provisioning BLE behavior available for observation.

Purpose:

- capture factory-fresh BLE advertisements and discoverability;
- compare advertised services/state with Plug A;
- verify whether read-only `Shelly.GetDeviceInfo` is available before setup;
- determine the clean onboarding decision flow;
- keep the device read-only during initial baseline capture.

Potential product flow to validate from evidence:

```text
BLE scan
-> candidate Shelly devices
-> connect
-> Shelly.GetDeviceInfo
-> physical identity + device state classification
-> fresh device: onboarding/configuration path
-> known/configured device: management path
```

Do not classify devices solely by BLE name. Always confirm physical identity through Shelly RPC when connection is available.

## Stage 0 — MacBook BLE protocol reconnaissance

The MacBook is an independent BLE host and diagnostic reference, not part of the shipped runtime.

Preferred paths:

1. native macOS CoreBluetooth helper (Swift) with no repository dependency;
2. official/reference Shelly Bluetooth RPC tooling when useful;
3. Bleak/CoreBluetooth as an optional diagnostic helper if already available or installed outside production dependencies.

Stage 0 is read-only initially.

Capture for every visible Shelly candidate:

- discovery timestamp;
- advertisement/local name;
- CoreBluetooth identifier;
- RSSI;
- advertised service UUIDs;
- connect success/failure;
- pairing/bonding prompt or requirement;
- discovered GATT services/characteristics and properties;
- `Shelly.GetDeviceInfo` result when possible;
- elapsed time and disconnect behavior.

Expected first comparison: Plug A vs Plug B in the same scan window.

## Stage 1 — protocol/transport tests without phone hardware

Implement pure framing/codec first and prove with fakes:

- request length big-endian encoding;
- UTF-8 request generation;
- single and multi-chunk responses;
- RX control initially reports zero/not-ready;
- exact response-length termination;
- malformed JSON;
- mismatched response id;
- Shelly RPC error envelope;
- timeout/abort;
- disconnect during request;
- two concurrent callers are serialized or one is explicitly rejected by contract.

No real relay mutation is needed for these tests.

## Stage 2 — Android/Capacitor binding

Reuse the existing `CapacitorBleGattClient`; do not build a second BLE stack.

Validate on Samsung S22+:

1. scan/discover candidate Shelly Plug;
2. connect/bond;
3. `Shelly.GetDeviceInfo`;
4. read-only status;
5. compare behavior with Mac reference;
6. only after reliable read path, perform controlled relay `OFF -> ON -> OFF` on the authorized development Plug A and verify final OFF.

Plug B remains read-only until its onboarding behavior has been captured and the configuration flow is deliberately designed.

## Tooling available for the spike

- GitHub: branch/source/docs/commits/review.
- Local Agent on the MacBook: local commands, Swift/CoreBluetooth helpers, Python diagnostics, package tests/builds, Android build, ADB and hardware exercises.
- MacBook Bluetooth/CoreBluetooth: independent GATT scan/connect/read/write diagnostic host.
- Samsung S22+ Bluetooth via existing Capacitor BLE adapter: target mobile implementation and acceptance host.
- Existing `@lcl/ble-core` `CapacitorBleGattClient`: app-side GATT primitive.
- Existing `@lcl/shelly-client` `ShellyRpcTransport`: transport abstraction to preserve.
- Official Shelly documentation/reference utilities: protocol and real-device behavior reference.

## Acceptance boundaries

### Stage 0 accepted when

- Mac detects and distinguishes both physical candidates when both are powered/in range;
- evidence records which one is configured vs fresh without relying only on name;
- at least `Shelly.GetDeviceInfo` is attempted on both and exact success/failure is recorded;
- no configuration or relay state has been changed by the reconnaissance.

### First BLE transport slice accepted when

- focused unit tests cover framing and failures;
- HTTP tests remain green;
- S22 proves BLE physical identity and read-only status;
- Plug A later completes `OFF -> ON -> OFF` and final OFF is explicitly verified;
- observed payload/chunk/timeout/reconnect constraints are documented.

## Lab journal

### 2026-09-25 — branch and scope

- Created `work/shelly-ble-transport` from current `main`.
- Confirmed existing `ShellyRpcTransport` is the correct package boundary.
- Confirmed the repository already has `CapacitorBleGattClient` with GATT connect/read/write/notifications, so a second application BLE stack is unnecessary.
- Decided to keep the first spike UI-free and hardware-first.

### 2026-09-25 — two-Plug test setup added

Planned simultaneous test environment:

- Plug A: existing configured development Plug, on home Wi-Fi, with current Shelly Link script/automation.
- Plug B: factory-fresh Plug powered directly from the box with no setup performed.

This is intentional test coverage for both management and future onboarding. Initial work on Plug B is read-only so its factory baseline is preserved.

### 2026-09-25 — MacBook diagnostic host added

MacBook Bluetooth/CoreBluetooth is now part of the planned test toolkit. It will provide an independent reference path for scanning, GATT discovery and Shelly RPC before the same behavior is implemented/validated through Android/Capacitor.

Next experiment: read-only Stage 0 scan on the MacBook, capture visible Shelly candidates, then attempt `Shelly.GetDeviceInfo` without changing either device.
