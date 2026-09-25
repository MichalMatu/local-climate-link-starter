# Handoff — Shelly BLE-only plug path

Status: **2026-09-26**

Repository: `MichalMatu/shelly-link`

Active branch: `work/shelly-ble-transport`

Current remote HEAD:

```text
4960828c9811e90f7c094f6ae893dc53f6ea0628  Update Add Plug visual contract
```

Important parent checkpoint:

```text
21b4360c7fcd8a6b1be2ab04ce5057f8471c30b4  Persist BLE-only plugs
```

Local Agent binding:

```text
e75c77cb-7589-4452-94b2-decc97ff85a1
```

## Product direction — DECIDED

Wi-Fi and Bluetooth are **independent add/runtime transports** for one physical Shelly Plug.

Do not treat BLE as a provisioning step whose purpose is to reach Wi-Fi.

Supported product directions are:

```text
physical Plug
  -> Wi-Fi-only
  -> BLE-only
  -> later optionally both transports for the same physical identity
```

The common physical identity is `Shelly.GetDeviceInfo.id`.

IP/baseUrl and platform BLE identifiers are transport locators, not physical identity.

The existing Wi-Fi flow is stable and intentionally frozen for this BLE work. Do not modify the HTTP/Wi-Fi onboarding/runtime unless a concrete Wi-Fi defect is discovered.

## Existing Wi-Fi identity — VERIFIED, DO NOT REWORK

Current Wi-Fi add path already behaves correctly:

```text
baseUrl / LAN address
-> HTTP Shelly RPC
-> Shelly.GetDeviceInfo
-> normalize Shelly device id
-> save Plug
```

Therefore an IP change does not define a new physical Plug.

For the current BLE track:

- do not change `checkShellyMutation`;
- do not change HTTP transport;
- do not redesign LAN scan;
- do not require BLE-only plugs to acquire Wi-Fi credentials;
- do not add automatic BLE -> Wi-Fi handoff.

## BLE protocol/transport — DONE

Implemented and validated:

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
- `BleShellyRpcTransport` implementing the existing `ShellyRpcTransport` contract;
- mobile binding through the existing `CapacitorBleGattClient`;
- Android initialization fix using `androidNeverForLocation: true`.

Key files:

```text
packages/shelly-client/src/rpc/bleProtocol.ts
packages/shelly-client/src/rpc/bleErrors.ts
packages/shelly-client/src/rpc/ble.ts
apps/mobile/src/platform/shellyBleTransport.ts
```

## Hardware evidence — DONE for transport

Two Shelly Plug S Gen3 devices were used.

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

Mac/Bleak and Samsung S22 proved real BLE RPC. Large `Shelly.GetStatus` responses required multiple DATA reads, proving chunk assembly on hardware.

Both plugs were explicitly authorized for relay testing and both passed:

```text
OFF -> ON -> OFF -> final read confirms OFF
```

This was proven first from Mac/Bleak and then through the real Android/Capacitor stack.

The fresh `E3E298` later stopped advertising BLE; both S22 and Mac scans confirmed it was absent from the air at that time. Do not misdiagnose that observation as an Android scan bug.

## BLE add UX — IMPLEMENTED

The old combined `Wi-Fi | Bluetooth` tab row inside Add Plug has been removed from the active direction.

Dashboard `+` now uses a small speed-dial/fan:

```text
        Bluetooth
            \
             +
            /
          Wi-Fi
```

Selecting Wi-Fi routes to the existing Wi-Fi add screen.

Selecting Bluetooth routes to a separate BLE-owned add page under `features/plugs`.

This keeps the Wi-Fi screen clean: it owns only its existing Wi-Fi choices such as network scan/manual address.

Key files:

```text
apps/mobile/src/features/plugs/components/PlugAddSpeedDial.tsx
apps/mobile/src/features/plugs/components/PlugAddSpeedDial.css
apps/mobile/src/features/plugs/components/PlugBluetoothAddPage.tsx
apps/mobile/src/features/plugs/components/PlugBluetoothAddPanel.tsx
apps/mobile/src/routes/AppRoutes.tsx
apps/mobile/src/screens/AutomationDashboardScreen.tsx
```

The BLE add flow is now intentionally read-only until explicit Save:

```text
BLE advertisement
-> stop scan
-> radio settle
-> Shelly.GetDeviceInfo only
-> verified physicalId/model/gen/fw
-> explicit Add
```

Active BLE onboarding no longer calls `WiFi.GetConfig`, `WiFi.GetStatus` or `WiFi.SetConfig`.

## BLE-only persistence — IMPLEMENTED

Do not force BLE-only devices into the existing HTTP `ShellyDraftDevice` shape because that model requires `baseUrl` and feeds HTTP runtime/settings.

A separate feature-owned BLE registry now exists.

Saved record:

```text
SavedBlePlug
  physicalId        // canonical Shelly.GetDeviceInfo.id
  name
  bleDeviceId       // transport locator/hint, NOT physical identity
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

Files:

```text
apps/mobile/src/features/plugs/data/savedBlePlug.ts
apps/mobile/src/features/plugs/data/savedBlePlugRepository.ts
apps/mobile/src/features/plugs/state/savedBlePlugStore.ts
```

Rules already implemented/tested:

- upsert is keyed by `physicalId`, not by BLE locator;
- a rediscovered same physical Plug with a new `bleDeviceId` updates the locator instead of duplicating the Plug;
- user name is preserved across rediscovery/upsert;
- malformed persisted data is rejected safely;
- user can rename/remove BLE-only saved plugs through the store;
- BLE Add panel exposes explicit Add after identity verification;
- already-saved physical identity is shown as already added and cannot be duplicated.

## Validation checkpoint

Focused BLE-only/persistence/routing validation on commit `21b4360c7` passed:

```text
7 test files
43 tests passed
mobile typecheck passed
UX quality gate passed
repository/feature-boundary gates passed
lint passed
```

The full `pnpm check` portion of pre-push also passed on that code. The canonical visual runner initially had a dev-server startup timing issue, so Vite was started explicitly and the same visual suite was run against it.

After intentionally updating only the changed Add Plug visual baseline:

```text
4 / 4 canonical visual E2E passed
```

The refreshed visual baseline is committed in current HEAD `4960828c9`.

## What is NOT done yet

The current BLE-only registry is not yet integrated as a fully usable Plug on the main dashboard/runtime.

Next missing product capabilities are:

1. **Dashboard presentation for saved BLE-only plugs.** Read `useSavedBlePlugStore` independently of the Wi-Fi `ShellyDraftDevice` store and render a BLE Plug card without requiring `baseUrl`.
2. **BLE runtime status hook.** Build a feature-owned runtime using `createShellyBleTransport(bleDeviceId)` + `RpcShellyClient.getStatus()`; ensure disconnect/lifecycle ownership is explicit.
3. **BLE relay control from dashboard/card.** Reuse the same Shelly RPC client methods (`Switch.Set`) with pending/error state and no blind retry after ambiguous timeout.
4. **BLE reconnect/rediscovery policy.** `bleDeviceId` is only a locator; if reconnect fails, scan and verify `GetDeviceInfo.id` before replacing the stored locator.
5. **BLE Plug detail/settings surface.** Decide which existing Plug settings are safe/useful over BLE and route calls through the BLE transport rather than copying HTTP logic into screens.
6. **Security/pairing/bonding.** Firmware behavior differs. The transport currently works on the tested devices, but durable BLE-only product support must explicitly handle newer Shelly BLE RPC security/bonding rules.
7. **Real S22 acceptance of the latest save flow.** Earlier S22 acceptance proved scan/identity and relay RPC; the newest speed-dial + explicit BLE-only Save registry should still be exercised end-to-end on the phone.
8. **Fresh-device BLE acceptance** remains blocked until `E3E298` advertises again or another fresh Shelly is available.

## Recommended next implementation slice

Keep the next slice small and independent of Wi-Fi:

```text
SavedBlePlug
-> BLE runtime hook
-> getStatus()
-> BLE-only dashboard card
-> ON/OFF control
```

Do NOT build BLE/Wi-Fi fallback yet.

Suggested ownership:

```text
product owner      -> features/plugs
state owner        -> useSavedBlePlugStore for BLE-only saved plugs
side-effect owner  -> feature runtime hook using createShellyBleTransport
transport owner    -> @lcl/shelly-client BleShellyRpcTransport
UI owner           -> dashboard card receives normalized runtime state/actions
identity           -> SavedBlePlug.physicalId / Shelly.GetDeviceInfo.id
locator            -> SavedBlePlug.bleDeviceId
```

Recommended sequence:

1. add `readBlePlugRuntimeStatus(savedPlug)` or equivalent narrow function using `RpcShellyClient`;
2. add focused fake-transport tests for status + relay action behavior;
3. add `useSavedBlePlugRuntime(savedPlug)` with explicit query/action lifecycle;
4. render saved BLE-only Plug card on dashboard without adding it to `ShellyDraftDevice`;
5. only then run real S22 read-only status;
6. after read-only passes, use the user's existing authorization to test `OFF -> ON -> OFF`, final OFF verification;
7. update this handoff/journal before broadening to settings/security.

## Scope guardrails

For the next chat:

- **do not refactor Wi-Fi**;
- **do not merge BLE store into `ShellyDraftDevice` just to reuse a card**;
- **do not identify hardware by IP, advertisement name, Android BLE address or CoreBluetooth UUID**;
- canonical identity remains normalized `Shelly.GetDeviceInfo.id`;
- a platform BLE id is only a reconnect locator;
- no automatic retry of mutating relay/config RPC after timeout/disconnect;
- do not implement transport fallback yet;
- no broad UX redesign; continue the accepted speed-dial direction;
- use GitHub for deterministic source/doc edits and Local Agent for tests/builds/hardware;
- one Local Agent task per repo at a time; always include exact binding above.

## Local Agent notes

Local Agent may be shared with other repos/chats. Parallel mode is enabled, but one repo still owns one task at a time.

The canonical visual runner had intermittent `webServer` startup waits. A reliable diagnostic was:

```text
start Vite explicitly on a free localhost port
wait for /admin to answer
set LCL_E2E_PORT to that port
run canonical Playwright visual suite
terminate the entire Vite process group
```

Do not interpret the earlier 120 s Playwright `webServer` wait as a product failure.

## Restart checklist

At the start of the next chat:

```text
read AGENTS.md
read docs/HANDOFF_NEXT_CHAT.md
read docs/SHELLY_BLE_SPIKE.md only as historical/lab evidence
work on branch work/shelly-ble-transport
verify branch HEAD is at least 4960828c9
check agent-control daemon and exact binding
confirm there is no active duplicate shelly-link task
continue with BLE-only runtime/dashboard slice
leave Wi-Fi implementation unchanged
```

`docs/HANDOFF_NEXT_CHAT.md` is authoritative for the current product direction. Older BLE->Wi-Fi provisioning ideas in the spike journal are historical experiments and must not override this handoff.
