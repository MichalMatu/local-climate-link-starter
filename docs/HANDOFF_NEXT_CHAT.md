# Handoff — Shelly BLE-only plug path

Status: **2026-09-26**

Repository: `MichalMatu/shelly-link`

Active branch: `work/shelly-ble-transport`

Current implementation checkpoint before this handoff update:

```text
e36397e48d7721b6efea349302d69069cd711f82  Test BLE-only dashboard integration
```

Starting checkpoint for the current runtime/dashboard slice:

```text
d3f2a3b8f0d971fce30ad21ca6829f3bd3b4195b
```

Local Agent binding:

```text
e75c77cb-7589-4452-94b2-decc97ff85a1
```

## Product direction — DECIDED

Wi-Fi and Bluetooth are independent add/runtime transports for one physical Shelly Plug.

Do **not** treat BLE as a Wi-Fi provisioning stage.

Target product modes:

```text
physical Plug
  -> BLE-only
  -> Wi-Fi-only
  -> later optionally both transports for the same physical identity
```

Canonical physical identity is normalized `Shelly.GetDeviceInfo.id`.

Transport locators are not identity:

- Wi-Fi IP / `baseUrl` is a Wi-Fi locator;
- Android BLE address / CoreBluetooth UUID / saved `bleDeviceId` is a BLE reconnect locator;
- advertisement name is not physical identity.

The existing Wi-Fi flow is stable and intentionally frozen for this BLE work. It already identifies devices through `Shelly.GetDeviceInfo.id`.

For the current BLE track:

- do not change `checkShellyMutation`;
- do not change HTTP transport;
- do not redesign LAN scan;
- do not require BLE-only plugs to acquire Wi-Fi credentials;
- do not add automatic BLE <-> Wi-Fi fallback yet.

## BLE protocol/transport — DONE

Implemented and previously validated:

- official Shelly BLE RPC service/characteristic UUIDs;
- UTF-8 JSON request framing;
- 4-byte big-endian request/response lengths;
- multi-chunk DATA response assembly;
- request-id validation;
- response-size limits;
- serialized RPC calls per connection;
- timeout/abort handling;
- connection invalidation after transport/protocol failure;
- no automatic retry of ambiguous mutating RPC;
- `BleShellyRpcTransport` implementing `ShellyRpcTransport`;
- mobile binding through the existing `CapacitorBleGattClient`;
- Android initialization using `androidNeverForLocation: true`.

Key files:

```text
packages/shelly-client/src/rpc/bleProtocol.ts
packages/shelly-client/src/rpc/bleErrors.ts
packages/shelly-client/src/rpc/ble.ts
apps/mobile/src/platform/shellyBleTransport.ts
```

## Existing real-hardware evidence — DONE for the transport

Configured Plug:

```text
Shelly.GetDeviceInfo.id = shellyplugsg3-e4b063d7f530
model = S3PL-00112EU
Gen 3
firmware = 1.7.5
```

Factory-fresh test Plug:

```text
Shelly.GetDeviceInfo.id = shellyplugsg3-e4b063e3e298
model = S3PL-00112EU
Gen 3
firmware = 1.2.3-matter22
```

Mac/Bleak and Samsung S22 previously proved real BLE RPC including multi-chunk `Shelly.GetStatus`.

Both plugs were explicitly authorized for relay testing and previously passed:

```text
OFF -> ON -> OFF -> final read confirms OFF
```

That evidence validates the transport, but it does **not** replace acceptance of the new dashboard runtime slice below.

## BLE add UX and BLE-only persistence — DONE

Dashboard `+` is a speed-dial/fan with independent Wi-Fi and Bluetooth paths.

Bluetooth Add is owned by `features/plugs` and currently follows:

```text
BLE advertisement
-> stop scan
-> radio settle
-> Shelly.GetDeviceInfo only
-> verified physicalId/model/gen/fw
-> explicit Add
```

The active BLE-only add flow does not use `WiFi.GetConfig`, `WiFi.GetStatus` or `WiFi.SetConfig`.

Separate BLE-only persistence exists and must remain separate from HTTP `ShellyDraftDevice`:

```text
SavedBlePlug
  physicalId        // canonical Shelly.GetDeviceInfo.id
  name
  bleDeviceId       // reconnect locator only
  advertisementName
  model
  generation
  firmwareId
  matterEnabled
```

Persistence key:

```text
lcl.savedBlePlugs.v1
```

Upsert/dedup is keyed by `physicalId`. Rediscovery can replace `bleDeviceId` without creating a second physical Plug.

## BLE-only runtime/dashboard slice — IMPLEMENTED, ACCEPTANCE PENDING

The next slice requested for this chat is now implemented on the branch.

Production path:

```text
SavedBlePlug
-> readBlePlugRuntimeStatus(savedPlug)
-> createShellyBleTransport(savedPlug.bleDeviceId)
-> RpcShellyClient
-> getStatus()
-> normalized { relayOn, telemetry, clock }
-> BLE-only dashboard card
```

Relay actions use the same `RpcShellyClient.setRelayOn()` / `setRelayOff()` RPC path.

Each BLE runtime operation owns a one-shot transport and performs best-effort `disconnect()` in `finally`.

React Query mutation retry is explicitly disabled:

```text
retry: false
```

Do not add automatic retry after an ambiguous mutating timeout/disconnect.

New files:

```text
apps/mobile/src/features/plugs/data/blePlugRuntime.ts
apps/mobile/src/features/plugs/data/blePlugRuntime.test.ts
apps/mobile/src/features/plugs/flows/useSavedBlePlugRuntime.ts
apps/mobile/src/features/plugs/components/BleOnlyPlugCard.tsx
apps/mobile/src/features/plugs/components/BleOnlyPlugCard.test.tsx
apps/mobile/src/__tests__/ble-only-dashboard.test.tsx
```

Updated files:

```text
apps/mobile/src/features/plugs/index.ts
apps/mobile/src/screens/AutomationDashboardScreen.tsx
```

Dashboard behavior in this slice:

- reads `useSavedBlePlugStore` independently of the Wi-Fi draft store;
- renders BLE-only saved plugs without inventing `baseUrl`;
- reuses the existing Plug-card presentation conventions and normalized Shelly status shape;
- shows power, voltage, energy and Shelly local time;
- exposes ON/OFF through BLE RPC;
- exposes explicit read/mutation pending and error state;
- app-resume runtime refetch includes BLE-only runtime queries;
- if the same canonical `physicalId` is already represented by an existing Wi-Fi Plug/installation, the separate BLE-only card is hidden rather than duplicating the physical Plug;
- this is presentation dedup only, **not** a BLE/Wi-Fi fallback/runtime merge.

## Validation state for the new slice — NOT YET ACCEPTED

Important: do not claim this runtime/dashboard slice is green yet.

The first Local Agent focused validation task was:

```text
shelly-ble-runtime-dashboard-validation-20260926-080
```

It reached the worker but stopped at Prettier before tests because two new runtime files needed formatting. Those formatting-only fixes were committed afterward.

No focused test/typecheck/lint result after those fixes is currently available.

Attempts to queue the corrected validation were not consumed by the Local Agent worker. The daemon was restarted and obtained a new PID, but subsequent validation tasks and even a minimal no-op queue probe remained unconsumed while status stayed `idle`.

Examples queued during diagnosis:

```text
shelly-ble-runtime-dashboard-validation-20260926-084
shelly-local-agent-queue-probe-20260926-085
```

Therefore, as of this handoff:

```text
focused tests        PENDING
mobile typecheck     PENDING
focused lint         PENDING
quality:ux           PENDING
quality:repo         PENDING
full pnpm check      PENDING
S22 read-only        PENDING for this new slice
S22 relay acceptance PENDING for this new slice
```

Do not substitute old Stage 2 hardware evidence for these pending checks.

## Exact next action after Local Agent recovers

First confirm:

```text
agent-control daemon state = idle
current_task_id = null
binding = e75c77cb-7589-4452-94b2-decc97ff85a1
```

Then run focused validation against the current remote branch, including at least:

```text
prettier --check on changed files
vitest:
  src/features/plugs/data/blePlugRuntime.test.ts
  src/features/plugs/components/BleOnlyPlugCard.test.tsx
  src/__tests__/ble-only-dashboard.test.tsx
  src/__tests__/automation-dashboard.test.tsx
@lcl/mobile typecheck
focused eslint
pnpm quality:ux
pnpm quality:repo
git diff --check
```

Fix only concrete failures; do not broaden scope.

If focused validation is green, run full:

```text
pnpm check
```

Then perform the hardware acceptance in this order:

1. Samsung S22 read-only status through the **new saved BLE runtime path**;
2. confirm canonical physical identity/locator being exercised is the expected test Plug;
3. only if the read path is reliable, perform authorized relay `OFF -> ON -> OFF`;
4. explicitly read final state and verify `relayOn=false`;
5. never auto-retry a timed-out/disconnected mutating relay RPC;
6. record exact hardware result here.

## Remaining product work after this slice is accepted

Do not broaden into these items until current runtime/dashboard acceptance is complete:

1. BLE reconnect/rediscovery policy when saved `bleDeviceId` is stale: scan, verify `GetDeviceInfo.id`, then replace locator.
2. BLE Plug detail/settings surface and explicit list of settings safe/useful over BLE.
3. Security/pairing/bonding policy for firmware that requires it.
4. Optional future dual-transport model for one physical Plug.
5. Optional transport selection/fallback policy — explicitly out of scope now.
6. Fresh-device BLE acceptance if `E3E298` advertises again or another fresh unit is available.

## Scope guardrails

- do not refactor Wi-Fi;
- do not merge `SavedBlePlug` into `ShellyDraftDevice` merely to reuse UI;
- do not add a fake `baseUrl`;
- do not identify hardware by IP, advertisement name, Android BLE address or CoreBluetooth UUID;
- canonical identity remains normalized `Shelly.GetDeviceInfo.id`;
- `bleDeviceId` remains only a reconnect locator;
- do not touch `checkShellyMutation`, HTTP transport or LAN scan for this slice;
- no automatic retry of mutating BLE RPC after timeout/disconnect;
- do not implement BLE/Wi-Fi fallback yet;
- use GitHub for deterministic source/docs;
- use Local Agent for tests/builds/hardware;
- do not start a second coding agent through Local Agent;
- one Local Agent task per repo at a time.

## Restart checklist

At the start of the next chat/work session:

```text
read AGENTS.md
read docs/HANDOFF_NEXT_CHAT.md
use docs/SHELLY_BLE_SPIKE.md only as historical/lab evidence
work on branch work/shelly-ble-transport
check fresh branch HEAD
check agent-control and binding
confirm no active duplicate shelly-link task
recover Local Agent queue execution
validate the already-implemented BLE runtime/dashboard slice
then S22 read-only -> authorized OFF/ON/OFF -> verified final OFF
leave Wi-Fi implementation unchanged
```

`docs/HANDOFF_NEXT_CHAT.md` is authoritative for current product direction. Older BLE->Wi-Fi provisioning/fallback ideas in the spike journal are historical and must not override this handoff.
