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

## Product direction — one Plug, two add paths

The Plugs surface should keep one physical-device model while allowing two ways to add a device:

```text
Plugs
  -> +
      -> Wi-Fi
      -> Bluetooth
```

The choice defines the onboarding transport, not a different kind of Plug.

### Add through Wi-Fi

```text
LAN discovery / address
-> Shelly.GetDeviceInfo
-> verify physical identity
-> save Plug
```

### Add through Bluetooth

```text
BLE scan
-> candidate Shelly
-> connect
-> Shelly.GetDeviceInfo
-> classify setup state
-> fresh Plug: optionally provision home Wi-Fi through native Shelly RPC
-> configured Plug: save/manage directly
-> save the same physical Plug model
```

After onboarding, transport choice remains an implementation/runtime concern. The durable identity is still `Shelly.GetDeviceInfo.id`.

Desired later runtime policy:

```text
preferred available transport
  Wi-Fi when reachable
  BLE when selected/appropriate and in range
  optional fallback between transports where firmware/security state permits
```

Do not persist independent "Wi-Fi Plug" and "BLE Plug" entities for the same hardware. Transport-specific identifiers such as URL/IP, BLE advertisement name, Android BLE id or CoreBluetooth UUID are locations/handles, not physical identity.

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

### Hardware-derived constraints

Stage 0 established the following concrete transport constraints:

- MacBook/Bleak negotiated `mtu=500` with both test Plugs.
- `Shelly.GetDeviceInfo` responses around 306–308 bytes fit in one Data read.
- `Shelly.GetStatus` already requires multiple Data reads: 700 bytes arrived in 2 chunks on the fresh Plug and 1244 bytes in 3 chunks on the configured Plug.
- RX control reported the response length on the first poll in all successful Stage 0 calls; the implementation must still support a bounded zero/not-ready polling loop.
- Multiple sequential RPC calls over one connection worked reliably in the read-only probe.
- On macOS/Bleak 3.0.2, unrestricted service discovery on the factory-fresh Matter Plug failed while discovering an unrelated descriptor with `CBErrorDomain Code=8`; restricting discovery to the Shelly RPC service made the same device work immediately. The product transport should avoid unnecessary broad GATT enumeration where the platform permits it.

## Hardware test matrix for the spike

Two physical Plug S Gen3 units are intentionally used.

### Plug A — existing configured development Plug

Observed identity after Stage 0:

```text
BLE name     ShellyPlugSG3-E4B063D7F530
Shelly id    shellyplugsg3-e4b063d7f530
model        S3PL-00112EU
firmware     1.7.5
matter       false
provision    complete
```

Observed state:

- connected to Wi-Fi (`got ip`; SSID/IP intentionally not logged);
- relay OFF during read-only reconnaissance;
- `Script.List` contains enabled/running `Shelly Link Thermostat`, id 1;
- `Shelly.GetStatus` contains `script:1`;
- BLE RPC service works from the MacBook.

Purpose:

- verify BLE management works on an already configured real device;
- compare BLE identity with the stored physical Plug identity;
- later test controlled relay transition;
- do not alter the existing script during the first spike.

### Plug B — factory-fresh Plug

Observed identity after Stage 0:

```text
BLE name     ShellyPlugSG3-E4B063E3E298
Shelly id    shellyplugsg3-e4b063e3e298
model        S3PL-00112EU
firmware     1.2.3-matter22
matter       true
```

Observed state:

- Wi-Fi disconnected;
- no SSID or station IP present;
- relay OFF with source `init`;
- `Script.List` empty;
- read-only BLE RPC works when GATT discovery is restricted to the Shelly RPC service;
- `GetDeviceInfo` does not expose the same `provision` field seen on Plug A, so onboarding classification must use explicit state evidence rather than depending on that field alone.

Purpose:

- preserve and understand the factory-fresh baseline;
- validate onboarding discovery/identity/state classification;
- keep the device read-only until configuration flow is deliberately designed.

Potential product flow validated by Stage 0 evidence:

```text
BLE scan
-> candidate Shelly devices
-> connect
-> Shelly.GetDeviceInfo
-> read minimal state needed for classification
-> physical identity + setup-state classification
-> fresh device: onboarding/configuration path
-> known/configured device: management path
```

Do not classify devices solely by BLE name or by presence of one firmware-specific field. Always confirm physical identity through Shelly RPC and classify setup state from typed RPC evidence.

## Stage 0 — MacBook BLE protocol reconnaissance — ACCEPTED

The MacBook is an independent BLE host and diagnostic reference, not part of the shipped runtime.

Stage 0 remained read-only and established:

- two Shelly Plug S Gen3 devices can be discovered in one scan;
- both can be uniquely identified through `Shelly.GetDeviceInfo`;
- the fresh and configured states can be distinguished without relying on advertisement name alone;
- the Shelly RPC framing defined by the official ALLTERCO utility works on both physical devices;
- multi-chunk responses are required in normal status traffic;
- no Wi-Fi, script, automation or relay mutation was performed.

Mac diagnostic implementation used a temporary Bleak environment outside the repository. It is test tooling only and adds no application dependency.

## Stage 1 — protocol/transport tests without phone hardware — IN PROGRESS

The pure framing/codec slice is implemented and focused verification is green:

- 4-byte big-endian request/response length encoding;
- UTF-8 request generation;
- single and multi-chunk response assembly;
- malformed JSON detection;
- mismatched response id detection;
- focused codec tests, package typecheck and lint pass.

Next Stage 1 slice is the smallest `BleShellyRpcTransport` around an injected GATT port. It must prove:

- RX control zero/not-ready polling;
- exact response-length reads;
- Shelly RPC error mapping;
- timeout/abort behavior;
- connection invalidation after mid-frame failure;
- serialization of concurrent callers.

No real relay mutation is needed for these tests. Do not add UI yet.

## Stage 2 — Android/Capacitor binding

Reuse the existing `CapacitorBleGattClient`; do not build a second BLE stack.

Validate on Samsung S22+:

1. scan/discover candidate Shelly Plug;
2. connect/bond if the device/firmware requires it;
3. `Shelly.GetDeviceInfo`;
4. read-only status;
5. compare behavior with Mac reference;
6. only after reliable read path, perform controlled relay `OFF -> ON -> OFF` on the authorized development Plug A and verify final OFF.

Plug B remains read-only until its onboarding behavior has been captured and the configuration flow is deliberately designed.

## Tooling available for the spike

- GitHub: branch/source/docs/commits/review.
- Local Agent on the MacBook: local commands, temporary Python/Bleak diagnostics, package tests/builds, Android build, ADB and hardware exercises.
- MacBook Bluetooth/CoreBluetooth: independent GATT scan/connect/read/write diagnostic host.
- Samsung S22+ Bluetooth via existing Capacitor BLE adapter: target mobile implementation and acceptance host.
- Existing `@lcl/ble-core` `CapacitorBleGattClient`: app-side GATT primitive.
- Existing `@lcl/shelly-client` `ShellyRpcTransport`: transport abstraction to preserve.
- Official ALLTERCO/Shelly BLE RPC utility and technical documentation: protocol reference.

## Acceptance boundaries

### Stage 0 — PASSED

- Mac detected and distinguished both physical candidates.
- Fresh vs configured state was established through RPC evidence.
- `Shelly.GetDeviceInfo` succeeded on both.
- Read-only status and script-list paths succeeded on both.
- Multi-chunk response handling was observed on real hardware.
- No device configuration or relay state was changed.

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

Initial work on Plug B is read-only so its factory baseline is preserved.

### 2026-09-25 — MacBook diagnostic host added

MacBook Bluetooth/CoreBluetooth became an independent reference path for scanning, GATT discovery and Shelly RPC before Android/Capacitor implementation.

A first native Swift/CoreBluetooth helper did not emit runtime output under the Local Agent watchdog and hit the no-output timeout. No device mutation occurred. The diagnostic path was switched to a temporary Python/Bleak venv outside the repository.

### 2026-09-25 — simultaneous BLE scan

Bleak 20-second scan found exactly two Shelly candidates:

```text
ShellyPlugSG3-E4B063E3E298   RSSI -37 dBm
ShellyPlugSG3-E4B063D7F530   RSSI -48 dBm
```

Both were strong enough for repeatable lab work.

### 2026-09-25 — GetDeviceInfo and macOS service-discovery finding

Configured Plug `D7F530` connected with unrestricted service discovery and returned `Shelly.GetDeviceInfo` immediately.

Factory-fresh Plug `E3E298` initially failed during broad descriptor discovery with CoreBluetooth error `The specified UUID is not allowed for this operation`. With Bleak restricted to the Shelly RPC service, the same Plug connected and returned `Shelly.GetDeviceInfo` immediately. This establishes a platform/tooling discovery issue rather than an RPC failure on the device.

Both connections reported MTU 500.

### 2026-09-25 — read-only state classification and framing evidence

Factory-fresh Plug `E3E298`:

```text
WiFi.GetStatus      disconnected, no SSID/IP
Switch.GetStatus    OFF, source init
Script.List         empty
Shelly.GetStatus    700 bytes, 2 Data chunks
```

Configured Plug `D7F530`:

```text
WiFi.GetStatus      got ip, SSID/IP present but not logged
Switch.GetStatus    OFF
Script.List         Shelly Link Thermostat, id 1, enabled/running
Shelly.GetStatus    1244 bytes, 3 Data chunks, includes script:1
```

All response-length reads were ready on the first RX-control poll. Multiple sequential RPCs on one BLE connection succeeded. Both Plugs were explicitly observed OFF; no relay command was sent.

Stage 0 is accepted.

### 2026-09-25 — onboarding transport UX direction

Product direction recorded:

```text
Plugs -> + -> Wi-Fi | Bluetooth
```

This is a choice of discovery/onboarding transport, not a split device model. Both paths converge on `Shelly.GetDeviceInfo.id` and the same saved Plug. BLE onboarding may later provision Wi-Fi credentials through native Shelly RPC, after which normal management may prefer Wi-Fi while retaining BLE as an available local transport/fallback where supported.

### 2026-09-25 — Stage 1 codec slice

Added pure BLE RPC codec/framing support and focused tests. Verification passed: 9 codec tests, `@lcl/shelly-client` typecheck and focused ESLint. Next implementation slice is the injected-GATT `BleShellyRpcTransport`; no UI or relay mutation yet.
