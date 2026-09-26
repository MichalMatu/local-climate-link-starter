# Handoff — Shelly BLE-only plug path

Status: **2026-09-26**

Repository: `MichalMatu/shelly-link`

Active branch: `work/shelly-ble-transport`

Local Agent binding:

```text
e75c77cb-7589-4452-94b2-decc97ff85a1
```

## Checkpoints

Starting checkpoint for the current runtime/dashboard slice:

```text
d3f2a3b8f0d971fce30ad21ca6829f3bd3b4195b
```

Last implementation commit before docs-only cleanup:

```text
e36397e48d7721b6efea349302d69069cd711f82  Test BLE-only dashboard integration
```

Previous handoff checkpoint:

```text
7214fea6f6919a223c2fa7073195c33def1b5d33  Update BLE runtime dashboard handoff
```

Docs-only cleanup after that checkpoint updated `docs/ARCHITECTURE.md`, `docs/ROADMAP.md` and this handoff. If HEAD is later than `e36397e`, distinguish docs-only commits from implementation before assuming code changed.

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

The existing Wi-Fi implementation is stable and frozen for this BLE slice.

Do not:

- change `checkShellyMutation`;
- change HTTP transport;
- redesign LAN scan;
- force BLE-only plugs into `ShellyDraftDevice`;
- invent a fake `baseUrl`;
- add BLE↔Wi-Fi fallback yet.

## BLE foundation — DONE

Implemented and previously hardware-validated:

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

Real hardware already proved transport-level BLE RPC on Samsung S22 and Shelly Plug S Gen3, including explicit:

```text
OFF -> ON -> OFF -> final read OFF
```

That older evidence validates the transport foundation only. It does **not** accept the new saved-runtime/dashboard slice below.

Practical configured test Plug if still advertising:

```text
physicalId = shellyplugsg3-e4b063d7f530
model = S3PL-00112EU
Gen 3
firmware = 1.7.5
```

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

## BLE-only runtime/dashboard slice — IMPLEMENTED, ACCEPTANCE PENDING

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

React Query read/mutation retry is disabled for this path. Never blindly retry a timed-out/disconnected mutating relay RPC.

New files:

```text
apps/mobile/src/features/plugs/data/blePlugRuntime.ts
apps/mobile/src/features/plugs/data/blePlugRuntime.test.ts
apps/mobile/src/features/plugs/flows/useSavedBlePlugRuntime.ts
apps/mobile/src/features/plugs/components/BleOnlyPlugCard.tsx
apps/mobile/src/features/plugs/components/BleOnlyPlugCard.test.tsx
apps/mobile/src/__tests__/ble-only-dashboard.test.tsx
```

Updated production files:

```text
apps/mobile/src/features/plugs/index.ts
apps/mobile/src/screens/AutomationDashboardScreen.tsx
```

Behavior:

- BLE-only saved plugs render independently from Wi-Fi draft persistence;
- status shows relay, power, voltage, energy and Shelly local time;
- ON/OFF goes through BLE RPC;
- explicit read/mutation pending and error state is exposed;
- app-resume refetch includes BLE runtime queries;
- if the same canonical physical ID is already represented by Wi-Fi/installations, the BLE-only card is hidden;
- that hiding is presentation dedup only, not transport fallback/merge.

## Software validation — STILL PENDING

Do not call this slice accepted yet.

The first Local Agent focused validation task reached the worker:

```text
shelly-ble-runtime-dashboard-validation-20260926-080
```

It stopped at Prettier because two new runtime files needed formatting. Those formatting-only fixes were committed afterward.

No post-fix focused test/typecheck/lint result has been obtained yet.

Pending:

```text
focused prettier     PENDING
focused tests        PENDING
mobile typecheck     PENDING
focused lint         PENDING
quality:ux           PENDING
quality:repo         PENDING
full pnpm check      PENDING
S22 read-only        PENDING for this new runtime path
S22 relay acceptance PENDING for this new runtime path
```

## Local Agent operational note

Current daemon observed after the Local Agent update:

```text
daemon_version = 4.18.25
state = idle
current_task_id = null
binding = e75c77cb-7589-4452-94b2-decc97ff85a1
```

During this chat, older file-based queue attempts were not consumed. After the 4.18.25 refresh the `.agent/queue` path disappeared from the tracked control tree until it was manually recreated; a small probe placed there still was not consumed and was then removed.

The user reported that another chat works normally with Local Agent. Therefore do **not** assume the Local Agent installation or machine is globally broken. Treat this as a conversation/intake-path issue until fresh evidence says otherwise.

At handoff there should be no active task from this chat and no stale probe to wait for.

In a new chat:

1. read fresh `agent-control/.agent/status/daemon.json` and binding;
2. confirm `current_task_id = null` before queuing work;
3. use the Local Agent protocol/bootstrap supplied to that new chat;
4. do **not** blindly recreate the old `.agent/queue` mechanism if the new bootstrap uses a different intake path;
5. never start a second coding agent through Local Agent.

## Exact next engineering action

Once Local Agent command execution works in the active chat, run focused validation against the current remote branch:

```text
prettier --check:
  apps/mobile/src/features/plugs/data/blePlugRuntime.ts
  apps/mobile/src/features/plugs/data/blePlugRuntime.test.ts
  apps/mobile/src/features/plugs/flows/useSavedBlePlugRuntime.ts
  apps/mobile/src/features/plugs/components/BleOnlyPlugCard.tsx
  apps/mobile/src/features/plugs/components/BleOnlyPlugCard.test.tsx
  apps/mobile/src/features/plugs/index.ts
  apps/mobile/src/screens/AutomationDashboardScreen.tsx
  apps/mobile/src/__tests__/ble-only-dashboard.test.tsx

vitest:
  src/features/plugs/data/blePlugRuntime.test.ts
  src/features/plugs/components/BleOnlyPlugCard.test.tsx
  src/__tests__/ble-only-dashboard.test.tsx
  src/__tests__/automation-dashboard.test.tsx

pnpm --filter @lcl/mobile typecheck
focused eslint on the same changed source/test files
pnpm quality:ux
pnpm quality:repo
git diff --check
```

Fix only concrete failures; do not broaden scope.

If focused validation is green, run exactly one final:

```text
pnpm check
```

Then hardware acceptance in this order:

1. Samsung S22 read-only status through the **new saved BLE runtime path**;
2. verify the expected canonical physical identity/locator;
3. only if read is reliable, authorized relay `OFF -> ON -> OFF`;
4. final read must explicitly verify `relayOn=false`;
5. never auto-retry an ambiguous mutating timeout/disconnect;
6. record exact evidence here.

## After this slice is accepted

Continue only then with:

1. stale `bleDeviceId` rediscovery: scan -> `GetDeviceInfo.id` verify -> replace locator;
2. BLE Plug detail/settings surface and safe/useful BLE settings;
3. pairing/bonding policy for firmware that requires it;
4. optional dual-transport representation for one physical Plug;
5. optional transport selection/fallback policy.

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
run focused software validation
run final pnpm check
then S22 read-only -> OFF/ON/OFF -> verified final OFF
leave Wi-Fi implementation unchanged
```

`docs/HANDOFF_NEXT_CHAT.md` is authoritative for this active BLE track. Older BLE->Wi-Fi provisioning/fallback ideas in the spike journal are historical and must not override this handoff.
