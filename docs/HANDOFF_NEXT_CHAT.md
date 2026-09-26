# Handoff — Shelly BLE management / autonomous next slice

Status: **2026-09-26 — BLE-only runtime/dashboard accepted; locator resilience is next**

Repository: `MichalMatu/shelly-link`

Active branch: `work/shelly-ble-transport`

## IMPORTANT: new-chat Local Agent binding

The previous chat used Local Agent binding:

```text
e75c77cb-7589-4452-94b2-decc97ff85a1
```

That value is **historical context only**. A new chat must obtain and use its own fresh Local Agent bootstrap/binding. Do not copy the old binding into new Local Agent tasks.

Before queuing any Local Agent work in the new chat:

1. read the fresh Local Agent bootstrap supplied to that chat;
2. confirm repository `MichalMatu/shelly-link` and branch `work/shelly-ble-transport`;
3. confirm there is no active duplicate task for this repository/branch;
4. use exactly the fresh binding from the new chat for every task;
5. never start a second coding agent through Local Agent.

## Source of truth before coding

Read in this order:

```text
AGENTS.md
apps/mobile/AGENTS.md
apps/mobile/src/features/AGENTS.md
docs/HANDOFF_NEXT_CHAT.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
```

`docs/SHELLY_BLE_SPIKE.md` is historical/lab evidence only. It must not override this handoff or the current roadmap.

## Accepted checkpoint — do not rebuild

Implementation checkpoint accepted before the current docs-only handoff updates:

```text
9fa79fe87ac24584e1fefa81badffeca8002d8d0  Format extracted BLE dashboard composition
```

Subsequent commits updating roadmap/handoff are docs-only. Check fresh branch HEAD when starting.

The following BLE work is already implemented and accepted and must not be rebuilt without a concrete defect:

- official Shelly BLE RPC transport/framing;
- Android/Capacitor GATT binding;
- independent Bluetooth Add flow;
- canonical identity verification through `Shelly.GetDeviceInfo.id`;
- `SavedBlePlug` persistence under `lcl.savedBlePlugs.v1`;
- BLE-only dashboard card;
- periodic status read over BLE;
- relay ON/OFF over BLE;
- explicit read/mutation pending/error handling;
- no automatic retry of ambiguous mutating BLE RPC;
- presentation dedup when the same physical Plug is already represented by Wi-Fi/installations.

Existing Wi-Fi behavior is stable/frozen for this track. Do not refactor it merely to make BLE code look more reusable.

## Product identity contract — DECIDED

One physical Shelly can eventually have more than one transport, but transport locators are not device identity.

```text
canonical physical identity = normalize(Shelly.GetDeviceInfo.id)
Wi-Fi baseUrl/IP            = Wi-Fi locator only
bleDeviceId                 = BLE reconnect locator only
advertisement name          = discovery metadata only
```

A candidate discovered during recovery is accepted as the saved Plug **only** when a real BLE `Shelly.GetDeviceInfo` call returns the same normalized canonical physical ID.

Advertisement name, MAC-looking suffix, RSSI, model or generation may be used to prioritize work, but none of them may replace the canonical identity check.

## Hardware acceptance already GREEN

Factory-fresh BLE-only test Plug:

```text
physicalId        = shellyplugsg3-e4b063e3e298
bleDeviceId       = E4:B0:63:E3:E2:9A
advertisementName = ShellyPlugSG3-E4B063E3E298
model             = S3PL-00112EU
generation        = 3
firmwareId         = 20240820-134301/1.2.3-plugsg3prod0-gec79607
matterEnabled      = true
```

Accepted dashboard read:

```text
relay = OFF
power = 0.0 W
voltage = 246-247 V
energy = 0 Wh
Shelly local time = —
```

The missing local time is expected because this Plug is factory-fresh and unconfigured.

The user manually confirmed relay control. A final read and another read after a refresh interval both showed:

```text
ON  pressed=false
OFF pressed=true
relayOn=false
```

Configured reference Plug already represented by Wi-Fi/installations:

```text
physicalId  = shellyplugsg3-e4b063d7f530
bleDeviceId = E4:B0:63:D7:F5:32
model       = S3PL-00112EU
generation  = 3
firmware    = 1.7.5
```

## Software validation already GREEN for accepted slice

Focused task:

```text
shelly-ble-runtime-focused-validation-20260926-435
```

Passed:

```text
Prettier
Vitest: 4 files / 24 tests
mobile typecheck
focused ESLint
pnpm quality:ux
pnpm quality:repo
git diff --check
```

Exactly one full gate for that accepted slice was run:

```text
shelly-ble-runtime-full-check-20260926-437
pnpm check -> GREEN
```

Do not rerun that old acceptance sequence merely to prove the old checkpoint again. A **new** full `pnpm check` is allowed and expected once, at the end of the new locator-resilience slice after its focused checks are green.

---

# AUTONOMOUS OVERNIGHT MISSION

The user intends the next chat to continue autonomously through the Local Agent/chat bridge while the user is away. Work only inside the bounded scope below.

## Primary goal: stale `bleDeviceId` recovery / BLE locator resilience

`SavedBlePlug.bleDeviceId` is a reconnect locator. It may become unusable while the physical Shelly remains the same device. Exact platform causes vary; do not assume a MAC-like Android locator is permanent, and do not treat an iOS/CoreBluetooth UUID as physical identity.

Desired recovery behavior:

```text
saved Plug
-> read-only BLE operation fails because saved locator cannot be used
-> bounded Shelly BLE scan
-> inspect candidates over BLE
-> Shelly.GetDeviceInfo.id
-> match normalized canonical physicalId
-> persist refreshed bleDeviceId
-> retry the original READ once using the refreshed locator
```

### Safety rules

These are hard constraints:

1. **Canonical identity only.** Never replace a locator without a matching normalized `Shelly.GetDeviceInfo.id`.
2. **No mutation replay.** Never automatically retry relay/settings/script/config mutations after timeout, disconnect or ambiguous BLE failure.
3. **Read-only recovery only by default.** Automatic rediscovery may be used to recover an idempotent/read-only status operation. A failed mutation may surface an error and may allow a separate recovery/read to refresh the locator, but it must require a later explicit user mutation attempt.
4. **Bounded recovery.** At most one rediscovery cycle for one failed read operation; no infinite scan/connect loop.
5. **No Wi-Fi fallback.** Do not add BLE↔Wi-Fi transport fallback or automatic transport selection in this slice.
6. **Preserve user data.** Locator refresh must preserve the user's custom Plug name. Verified metadata may be refreshed from the matched device where appropriate.
7. **No fake identity.** Advertisement suffix/RSSI/model/gen can prioritize candidates only.
8. **No destructive persistence migration unless proven necessary.** Prefer the existing `SavedBlePlug` schema/version if it already represents the needed state.
9. **Do not couple low-level runtime code directly to Zustand unless repository architecture clearly requires it.** Prefer a testable recovery service/flow with injected scan/inspect/persist dependencies and keep UI/store orchestration at the appropriate layer.
10. **Do not touch the stable Wi-Fi lifecycle, `checkShellyMutation`, HTTP transport or LAN scan.**

## Phase A — preimplementation audit, then implement locator recovery

Start with a short code audit before edits. Inspect at least:

```text
apps/mobile/src/features/plugs/data/blePlugRuntime.ts
apps/mobile/src/features/plugs/data/savedBlePlug.ts
apps/mobile/src/features/plugs/state/savedBlePlugStore.ts
apps/mobile/src/features/plugs/flows/scanPlugBleCandidates.ts
apps/mobile/src/features/plugs/flows/inspectPlugBleCandidate.ts
apps/mobile/src/features/plugs/flows/usePlugBleAddFlow.ts
apps/mobile/src/features/plugs/flows/useSavedBlePlugRuntime.ts
apps/mobile/src/features/plugs/components/BleOnlyPlugCard.tsx
apps/mobile/src/platform/shellyBleTransport.ts
relevant @lcl/ble-core scanner/GATT error contracts
relevant @lcl/shelly-client error/result contracts
```

Audit questions:

- Which concrete error/result types distinguish connect/locator failure from an RPC/device error?
- Can recovery be triggered conservatively without treating every Shelly RPC error as a stale locator?
- What scanner lifecycle/radio-settle behavior must be reused from Add?
- How should concurrent reads avoid duplicate rediscovery for the same physical Plug?
- Where should the successful locator update live so the store, persisted record and React Query key converge cleanly?

Then implement the smallest cohesive vertical slice that satisfies the desired behavior.

### Preferred architecture, not a rigid file prescription

Reuse existing primitives instead of cloning Add logic:

```text
scanPlugBleCandidates
inspectPlugBleCandidate
buildVerifiedPlugBleCandidate / savedBlePlugFromCandidate
normalizeShellyDeviceId
```

A recovery primitive should be testable without real Bluetooth and should conceptually take:

```text
saved physical identity
current locator
scan dependency
candidate inspection dependency
locator/verified-candidate persistence dependency
```

It should return an explicit outcome such as recovered/not-found/failed rather than silently mutating unrelated state.

Do not introduce a general multi-transport abstraction in this slice.

## Phase B — integrate recovery into saved BLE read runtime

Integrate recovery with the **read-only saved BLE status path**.

Acceptance behavior:

- normal healthy locator: same behavior as today, no scan;
- stale/unusable locator: one bounded rediscovery cycle;
- matching candidate found: persisted locator is updated, then read is retried once with the new locator;
- wrong candidates only: no persistence change, read remains failed with an explicit error state;
- scan/inspect failure: no persistence change, explicit error state;
- multiple candidates: only the canonical identity match may update the locator;
- custom name survives locator refresh;
- app/runtime remains usable after recovery and subsequent normal polls use the refreshed locator;
- no duplicate uncontrolled recovery loops from polling/refetch.

For mutation behavior, add/retain regression coverage proving that relay mutation is **not** automatically replayed through rediscovery.

Do not create a hidden `OFF/ON` hardware test while the user is away.

## Phase C — tests and validation

Add focused tests covering at minimum:

```text
healthy locator -> no rediscovery
stale locator -> matching physicalId -> locator persisted -> read retried once
candidate with wrong physicalId -> rejected -> locator unchanged
no matching candidate -> locator unchanged
scan failure -> locator unchanged
candidate inspect/GetDeviceInfo failure -> conservative failure / continue only if bounded policy says so
custom name preserved after verified refresh
multiple candidates -> only canonical identity match accepted
read retry bounded to one recovery cycle
relay mutation failure -> no automatic mutation retry/replay
```

Also test any concurrency/single-flight mechanism introduced for recovery.

Validation order for this new slice:

```text
focused prettier --check on changed files
focused Vitest for new/affected locator/runtime/store/card tests
pnpm --filter @lcl/mobile typecheck
focused ESLint
pnpm quality:ux
pnpm quality:repo
git diff --check
```

Fix only concrete failures. Avoid broad refactors.

When focused validation is fully green, run **exactly one new**:

```text
pnpm check
```

for the locator-resilience slice.

Commit cohesive changes on `work/shelly-ble-transport` and update this handoff with exact test results and the new implementation checkpoint.

## Phase D — overnight stretch work, only after Phase A-C are green

If locator resilience is complete and software-green while the user is still away, do **not** start risky settings mutations or real-device actions.

Instead perform a read-only design/audit of the next BLE Plug detail/settings slice:

1. inventory the current Wi-Fi Plug detail sections and the existing `@lcl/shelly-client` read/mutation methods;
2. classify capabilities into:
   - read-only and safe to expose over BLE now;
   - mutation potentially safe but requiring explicit product/hardware acceptance;
   - blocked/unsafe/transport-specific;
3. identify the smallest BLE detail/Info read-only vertical slice that could be implemented next without fake `baseUrl`, Wi-Fi fallback or lifecycle refactors;
4. document the proposal in this handoff or a focused new design doc;
5. tests/design work are allowed; **do not implement new real-device settings mutations without user review**.

If a very small read-only detail/Info slice is mechanically obvious and uses already existing client contracts without product ambiguity, it may be implemented with focused tests. Stop before any new settings mutation.

---

# AUTONOMY / STOP CONDITIONS

While the user is away, the new chat may autonomously:

- inspect and edit code/docs on `work/shelly-ble-transport`;
- create focused tests;
- run local builds/tests/typecheck/lint/repository quality through Local Agent;
- make small cohesive commits;
- update this handoff with exact results;
- continue from locator recovery into the read-only detail/settings audit described above.

The new chat must **stop and leave a clear handoff**, rather than guessing, if any of these occurs:

- a change would require altering the stable Wi-Fi/HTTP lifecycle;
- canonical identity cannot be proven safely;
- a persistence migration/destructive data change becomes necessary;
- the only path forward requires automatically replaying a mutating BLE RPC;
- pairing/bonding policy requires a product decision or user interaction;
- hardware acceptance requires touching relay/settings while the user is unavailable;
- Android permissions/system dialogs require manual interaction;
- tests expose an architectural conflict larger than the locator-resilience slice;
- a proposed refactor substantially broadens scope beyond BLE locator recovery/read-only detail work.

Do not merge to `main`, delete branches, clear app data, uninstall the app, factory-reset devices, or perform real-device mutations while the user is away.

## Hardware work is intentionally deferred until the user returns

Software can become green overnight, but real locator-recovery acceptance should be done with the user present.

Preferred hardware acceptance tomorrow:

1. use the factory-fresh BLE-only Plug `shellyplugsg3-e4b063e3e298`;
2. deliberately create a controlled stale-locator condition without destroying unrelated app data;
3. trigger a read-only status operation;
4. prove scan -> `GetDeviceInfo.id` match -> persisted locator replacement -> successful status read;
5. verify the canonical physical identity did not change;
6. no relay mutation is required for this acceptance;
7. record exact before/after locator and final read result in this handoff.

Do not mutate Local Storage by ad-hoc DevTools scripting as the production acceptance path unless the user explicitly authorizes a test-only setup. Prefer a controlled test seam or a legitimate state transition.

## Current next-chat instruction in one sentence

Continue autonomously on `work/shelly-ble-transport` from the accepted BLE-only runtime/dashboard checkpoint; implement and software-validate conservative stale-`bleDeviceId` rediscovery for read-only BLE runtime, never replay mutations, do not touch Wi-Fi, then use remaining time only for a read-only BLE detail/settings audit and leave hardware acceptance for the user.
