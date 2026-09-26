# Handoff — Shelly BLE-only plug path

Status: **2026-09-26 — runtime/dashboard slice accepted**

Repository: `MichalMatu/shelly-link`

Active branch: `work/shelly-ble-transport`

Local Agent binding:

```text
e75c77cb-7589-4452-94b2-decc97ff85a1
```

## Accepted checkpoint

Implementation checkpoint before this handoff update:

```text
9fa79fe87ac24584e1fefa81badffeca8002d8d0  Format extracted BLE dashboard composition
```

This checkpoint includes the BLE-only saved runtime/dashboard slice plus the dashboard composition extraction required to satisfy repository line-budget checks.

Relevant formatting/extraction commits in the final implementation sequence:

```text
c0c5cdaded4ed2b46c4393c6eca95cd071c08249  Format BLE runtime status type
73f0e2fd473d44e9b570f58f57b72be4d4fb6276  Format BLE dashboard test
6e0723a4b7425bb11b0a8a4a8f3522cb5f8735db  Extract BLE-only dashboard composition
9fa79fe87ac24584e1fefa81badffeca8002d8d0  Format extracted BLE dashboard composition
```

## Product direction — DECIDED

Wi-Fi and Bluetooth are independent add/runtime transports for one physical Shelly Plug.

```text
physical Plug
  -> BLE-only
  -> Wi-Fi-only
  -> later optionally both transports for the same physical identity
```

Canonical physical identity is normalized `Shelly.GetDeviceInfo.id`.

Transport locators are not identity:

- Wi-Fi IP / `baseUrl` = Wi-Fi locator;
- Android BLE address / CoreBluetooth UUID / saved `bleDeviceId` = BLE reconnect locator;
- advertisement name = discovery metadata only.

The existing Wi-Fi implementation remains stable/frozen for this BLE slice.

Do not:

- change `checkShellyMutation`;
- change HTTP transport;
- redesign LAN scan;
- force BLE-only plugs into `ShellyDraftDevice`;
- invent a fake `baseUrl`;
- add automatic BLE↔Wi-Fi fallback yet;
- add automatic retry for ambiguous mutating BLE RPC.

## BLE foundation — DONE

Implemented and hardware-validated:

- Shelly BLE RPC framing/service/characteristic UUIDs;
- UTF-8 JSON + 4-byte big-endian lengths;
- multi-chunk response assembly;
- request-id validation and response-size limits;
- serialized RPC calls per connection;
- timeout/abort handling and connection invalidation;
- no automatic retry of ambiguous mutating RPC;
- `BleShellyRpcTransport` behind `ShellyRpcTransport`;
- mobile binding through `CapacitorBleGattClient`;
- Android initialization with `androidNeverForLocation: true`.

## BLE Add + persistence — DONE

Bluetooth Add is independent from Wi-Fi provisioning:

```text
BLE advertisement
-> stop scan
-> radio settle
-> Shelly.GetDeviceInfo
-> verified physical identity/model/gen/fw
-> explicit Add
```

The active path does not use `WiFi.GetConfig`, `WiFi.GetStatus` or `WiFi.SetConfig`.

BLE-only durable record:

```text
SavedBlePlug
  physicalId
  name
  bleDeviceId
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

Upsert/dedup is by normalized `physicalId`; `bleDeviceId` is only the reconnect locator and may change.

## BLE-only runtime/dashboard slice — ACCEPTED

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

Relay actions use `RpcShellyClient.setRelayOn()` / `setRelayOff()` over BLE.

Each runtime operation creates a one-shot transport and best-effort disconnects in `finally`.

React Query read/mutation retry is disabled for this path. Mutating relay RPC is one-shot and is not automatically retried after timeout/disconnect.

Dashboard behavior:

- BLE-only saved plugs render independently from Wi-Fi draft persistence;
- status shows relay, power, voltage, energy and Shelly local time;
- ON/OFF goes through BLE RPC;
- read/mutation pending and error state is explicit;
- app-resume refetch includes BLE runtime queries;
- if the same canonical physical ID is already represented by Wi-Fi/installations, the BLE-only card is hidden;
- that hiding is presentation dedup only, not transport fallback/merge.

The final dashboard composition is extracted to:

```text
apps/mobile/src/features/plugs/components/BleOnlyPlugDashboardCards.tsx
```

## Software validation — GREEN

Focused Local Agent task:

```text
shelly-ble-runtime-focused-validation-20260926-435
```

Passed:

```text
Prettier check on changed BLE runtime/dashboard files
Vitest: 4 files / 24 tests
  src/features/plugs/data/blePlugRuntime.test.ts
  src/features/plugs/components/BleOnlyPlugCard.test.tsx
  src/__tests__/ble-only-dashboard.test.tsx
  src/__tests__/automation-dashboard.test.tsx
pnpm --filter @lcl/mobile typecheck
focused ESLint
pnpm quality:ux
pnpm quality:repo
git diff --check
```

`quality:repo` had initially exposed `AutomationDashboardScreen.tsx` at 604 lines versus the 600-line budget. The cohesive BLE-only dashboard composition was extracted; the final focused validation then passed.

Exactly one final full check was run after focused validation:

```text
shelly-ble-runtime-full-check-20260926-437
pnpm check -> GREEN
```

Do **not** rerun another full `pnpm check` merely to re-prove this accepted checkpoint.

## Samsung S22 hardware acceptance — GREEN

Acceptance used a second, factory-fresh Shelly Plug so the BLE-only card was not hidden by existing Wi-Fi presentation dedup.

Discovered advertisement:

```text
advertisementName = ShellyPlugSG3-E4B063E3E298
bleDeviceId       = E4:B0:63:E3:E2:9A
RSSI during scan  = -43 dBm
```

`Info` performed the real BLE `Shelly.GetDeviceInfo` verification and produced:

```text
physicalId    = shellyplugsg3-e4b063e3e298
model         = S3PL-00112EU
generation    = 3
firmwareId    = 20240820-134301/1.2.3-plugsg3prod0-gec79607
matterEnabled = true
```

After explicit Add, `lcl.savedBlePlugs.v1` contained the exact canonical physical ID and reconnect locator above.

The dashboard rendered a separate card:

```text
ShellyPlugSG3-E4B063E3E298
Bluetooth · S3PL-00112EU
```

Read-only runtime evidence from the new saved BLE path:

```text
relay = OFF
power = 0.0 W
voltage = 246-247 V
energy = 0 Wh
Shelly local time = —
```

The missing Shelly local time is expected for this factory-fresh, unconfigured plug.

User manually exercised the relay and confirmed the physical ON/OFF behavior. Acceptance state sequence was:

```text
initial BLE read OFF
-> ON works
-> final OFF
```

Final read task:

```text
shelly-ble-s22-final-read-20260926-456
```

showed the BLE-only card with `OFF` selected.

A second read after another runtime refresh interval was deliberately taken to rule out merely optimistic mutation state:

```text
shelly-ble-s22-final-stable-read-20260926-457
```

It again showed:

```text
Bluetooth · S3PL-00112EU
0.0 W
246 V
0 Wh
—
ON  pressed=false
OFF pressed=true
```

Therefore the final saved-runtime read is accepted as:

```text
relayOn = false
```

No automatic retry of mutating BLE RPC is present in the accepted implementation (`retry: false` in the mutation path; runtime test coverage exercises one-shot relay mutation behavior).

For reference, the previously configured test plug is:

```text
physicalId = shellyplugsg3-e4b063d7f530
bleDeviceId = E4:B0:63:D7:F5:32
model = S3PL-00112EU
Gen 3
firmware = 1.7.5
```

It is already represented through the Wi-Fi/install path, so the BLE-only dashboard card is intentionally hidden for that same canonical physical identity.

## Current state / do not redo

The current slice is accepted. Do not rebuild BLE Add, SavedBlePlug persistence, BLE runtime polling, or the BLE-only dashboard card unless a concrete bug appears.

Do not rerun the accepted software/hardware sequence by default.

## Exact next engineering action

Continue with the next BLE reliability item:

1. stale `bleDeviceId` rediscovery:
   - reconnect failure / stale locator;
   - scan advertisements;
   - verify candidate using `Shelly.GetDeviceInfo.id`;
   - only replace the stored locator when canonical physical identity matches;
2. BLE Plug detail/settings surface and only safe/useful BLE settings;
3. pairing/bonding policy for firmware that requires it;
4. optional dual-transport representation for one physical Plug;
5. optional transport selection/fallback policy.

Do not implement automatic BLE↔Wi-Fi fallback as part of locator rediscovery.

## Restart checklist for a new chat

```text
read AGENTS.md
read apps/mobile/AGENTS.md
read apps/mobile/src/features/AGENTS.md
read docs/HANDOFF_NEXT_CHAT.md
read docs/ARCHITECTURE.md and docs/ROADMAP.md
use docs/SHELLY_BLE_SPIKE.md only as historical/lab evidence
work on branch work/shelly-ble-transport
check fresh branch HEAD
check fresh Local Agent bootstrap + binding
confirm no active duplicate task
continue from accepted BLE runtime/dashboard checkpoint
leave Wi-Fi implementation unchanged
```

`docs/HANDOFF_NEXT_CHAT.md` is authoritative for this active BLE track. Older BLE->Wi-Fi provisioning/fallback ideas in the spike journal are historical and must not override this handoff.
