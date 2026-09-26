# Handoff — Shelly BLE management / autonomous overnight work

Status: **2026-09-26 — Phase 0 UX + stale BLE locator recovery software-green; final combined gate pending**

Repository: `MichalMatu/shelly-link`

Active branch: `work/shelly-ble-transport`

## IMPORTANT: new-chat Local Agent binding

The previous chat used Local Agent binding:

```text
e75c77cb-7589-4452-94b2-decc97ff85a1
```

That value is **historical context only**. A new chat must obtain and use its own fresh Local Agent bootstrap/binding. Do not copy the old binding into new Local Agent tasks.

Before queuing Local Agent work in the new chat:

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

`docs/SHELLY_BLE_SPIKE.md` is historical/lab evidence only and must not override this handoff.

## Accepted checkpoint — do not rebuild

Accepted BLE-only implementation checkpoint before docs-only handoff updates:

```text
9fa79fe87ac24584e1fefa81badffeca8002d8d0  Format extracted BLE dashboard composition
```

The following is already implemented and accepted and must not be rebuilt without a concrete defect:

- Shelly BLE RPC transport/framing;
- Android/Capacitor GATT binding;
- independent Bluetooth Add flow;
- canonical identity verification through `Shelly.GetDeviceInfo.id`;
- `SavedBlePlug` persistence under `lcl.savedBlePlugs.v1`;
- BLE-only dashboard card and periodic status reads;
- relay ON/OFF over BLE;
- explicit read/mutation pending/error state;
- no automatic retry of ambiguous mutating BLE RPC;
- presentation dedup when the same physical Plug is represented by Wi-Fi/installations.

Existing Wi-Fi behavior is stable/frozen. Do not refactor Wi-Fi, `checkShellyMutation`, HTTP transport or LAN scan merely to make BLE reuse easier.

## Product identity contract — DECIDED

```text
canonical physical identity = normalize(Shelly.GetDeviceInfo.id)
Wi-Fi baseUrl/IP            = Wi-Fi locator only
bleDeviceId                 = BLE reconnect locator only
advertisement name          = discovery metadata only
```

Advertisement suffix, RSSI, model or generation may help presentation/prioritization, but only a real BLE `Shelly.GetDeviceInfo.id` match may prove physical identity.

## Accepted hardware evidence

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

The user manually confirmed relay control. Final read plus another refresh interval both showed `relayOn=false` / OFF selected.

Configured reference Plug already represented by Wi-Fi/installations:

```text
physicalId  = shellyplugsg3-e4b063d7f530
bleDeviceId = E4:B0:63:D7:F5:32
model       = S3PL-00112EU
generation  = 3
firmware    = 1.7.5
```

## Accepted software validation

Focused task `shelly-ble-runtime-focused-validation-20260926-435` passed Prettier, 4 Vitest files / 24 tests, mobile typecheck, focused ESLint, `quality:ux`, `quality:repo`, and `git diff --check`.

Exactly one full gate for that accepted slice was run:

```text
shelly-ble-runtime-full-check-20260926-437
pnpm check -> GREEN
```

Do not rerun the old acceptance sequence just to re-prove the old checkpoint.

## Overnight software checkpoint — current chat

Completed commits on `work/shelly-ble-transport`:

```text
9feadd7be22b0e273516f0e4331008d751a9a8e4  Polish BLE plug discovery UX
4adb8bbb6ff836a759d0fc6084d9aaacd43b8ba9  Recover stale BLE plug locators on reads
7a1f68044e6f8add0d89c950577449b3d5e8a20c  Format BLE locator recovery
```

Phase 0 focused validation passed 7 Vitest files / 26 tests, mobile typecheck, focused Prettier/ESLint, `quality:ux`, `quality:repo` and `git diff --check`. Locator recovery focused validation passed 4 Vitest files / 23 tests with the same focused gates. Combined validation passed 10 Vitest files / 46 tests and the existing responsive Plug-route Playwright coverage at `360x800`, `390x844`, `412x915`, `768x1024` and `1440x900` (5/5).

The recovery boundary is read-only only: a retryable `shelly-offline` / `timeout` status read may perform one bounded scan; only normalized `Shelly.GetDeviceInfo.id` can authorize locator replacement; the refreshed locator is persisted without changing the custom Plug name; the read is retried once; concurrent recovery is single-flight per physical Plug. Relay/settings/script/config mutations do not use this recovery path and are never automatically replayed.

A Phase 0 push attempt triggered the repository pre-push hook unexpectedly. Its `pnpm check` stopped immediately at the pre-existing formatting issue in this handoff file, before later check stages. That attempt is not the final combined acceptance gate. This checkpoint formats the handoff before the one required final combined `pnpm check`.

Real stale-locator hardware acceptance remains deferred until the user is present. No real device mutation was performed during this overnight work.

---

# AUTONOMOUS OVERNIGHT MISSION

Work autonomously only inside the bounded scope below. Make small cohesive commits and keep this handoff updated with exact checkpoints/results.

## Phase 0 — user-requested BLE UX polish — SOFTWARE DONE

These are concrete UX defects/requests observed on the real Samsung S22 after BLE runtime acceptance.

### 0.1 Plug Add speed-dial geometry

Current Wi-Fi/Bluetooth actions around the `+` FAB are visually asymmetric.

Required:

- make Wi-Fi and Bluetooth secondary actions visually symmetric around the main `+` trigger;
- use equal visual distance/gap and matching control size;
- preserve focusability, touch targets, motion tokens and `prefers-reduced-motion` behavior;
- do not change the meaning of the two transports.

Primary files:

```text
apps/mobile/src/features/plugs/components/PlugAddSpeedDial.tsx
apps/mobile/src/features/plugs/components/PlugAddSpeedDial.css
```

### 0.2 Remove visible `Refreshing…` footer from BLE-only dashboard card

The BLE-only card currently shows a visible refreshing/status footer after ON/OFF and during normal refetch, which causes a distracting/inconsistent layout change.

Required:

- remove the visible normal `dashboard.refreshing` / `Refreshing from Shelly` message from this card;
- keep `aria-busy` and disabled/busy control semantics;
- keep visible read/mutation errors;
- retain optimistic relay behavior and post-mutation invalidation;
- normal background polling/refetch must not make the card jump vertically.

Primary file:

```text
apps/mobile/src/features/plugs/components/BleOnlyPlugCard.tsx
```

### 0.3 BLE Plug Add must auto-start scanning

Entering Bluetooth Plug Add should behave like thermometer phone-BLE Add.

Required:

- start scan automatically once when the BLE Plug Add surface is entered;
- stop scan on unmount/exit;
- keep a Stop / Scan again control;
- do not start duplicate overlapping scans;
- use the existing thermometer add behavior as the UX/lifecycle reference, not as code to copy blindly.

Reference:

```text
apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx
```

### 0.4 Stable first-seen candidate ordering — no flicker

The current Plug candidate list is sorted repeatedly by RSSI, so two plugs jump above/below each other as RSSI changes.

Required:

- order candidates by first discovery for the lifetime of a scan/result list;
- repeated advertisements may update RSSI/name/metadata **in place** but must not move an existing card;
- final scan result must preserve first-seen order too;
- a new scan may start a fresh order;
- add focused regression tests where RSSI changes repeatedly without reordering cards.

Known sources of current behavior:

```text
apps/mobile/src/features/plugs/flows/usePlugBleAddFlow.ts
apps/mobile/src/features/plugs/flows/scanPlugBleCandidates.ts
```

### 0.5 Remove `Info`; use direct `Add` / `Added` on every discovered Plug card

The extra Info step is not the desired product UX. Match the thermometer discovery pattern more closely.

Required presentation:

```text
discovered Plug card
  identity / name
  compact metadata
  optional read-only preview
  Add  /  Added
```

Rules:

- remove the separate `Info` button from candidate cards;
- show `Add` directly on each candidate card;
- saved physical devices show disabled `Added`;
- never persist an unverified candidate;
- clicking `Add` on an unverified candidate may perform the required `Shelly.GetDeviceInfo` verification and save only after canonical ID verification succeeds;
- alternatively, bounded automatic verification may enrich candidates before Add becomes actionable if that produces cleaner code/UX;
- regardless of presentation, **canonical `Shelly.GetDeviceInfo.id` verification remains mandatory**;
- wrong identity / verification failure must never save a Plug;
- do not use advertisement suffix as identity proof.

Prefer a candidate-card state model such as advertisement-only / verifying / verified / saved / failed rather than one global `verifiedCandidate` card detached from its discovery row, if this can be done cohesively without broad refactor.

Primary files likely include:

```text
apps/mobile/src/features/plugs/components/PlugBluetoothAddPanel.tsx
apps/mobile/src/features/plugs/components/PlugBluetoothAddPanel.test.tsx
apps/mobile/src/features/plugs/components/PlugBluetoothAddPage.tsx
apps/mobile/src/features/plugs/flows/usePlugBleAddFlow.ts
apps/mobile/src/features/plugs/flows/inspectPlugBleCandidate.ts
```

### 0.6 Restyle discovered Plug cards consistently

Use the established `device-discovery-card` visual language from thermometer BLE Add:

- clear header/identity;
- `Add`/`Added` in the primary action position;
- compact device metadata;
- compact metrics area/strip where useful;
- no duplicated detached verified card above the raw discovery card;
- preserve responsive/touch accessibility and project tokens.

Reference pattern:

```text
apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx
apps/mobile/src/screens/hardware-setup/pages/SensorSetupPresentation.tsx
```

Do not make a visually unrelated one-off card system.

### 0.7 Cheap read-only Plug preview on discovery cards — preferred if cohesive

The user would like a quick preview such as voltage, current, power and time, similar in usefulness to the main card.

Existing `ShellyStatus` telemetry can expose:

```text
relayOn
powerW
voltageV
currentA
energyWh
clock.localTime
```

Preferred behavior:

- after canonical identity verification, obtain at most one bounded read-only `getStatus()` sample for preview when practical;
- if possible, reuse the same one-shot verified connection/client rather than opening unnecessary extra connections;
- no periodic polling on the discovery list;
- no mutation;
- preview failure must **not** block Add once canonical identity is already verified;
- show `—` for unavailable values;
- avoid a connection storm when multiple plugs are present: sequential/single-flight enrichment is preferred;
- do not perform GATT inspection concurrently with an active scan if the current BLE stack requires scan-stop/radio-settle behavior.

This preview is preferred, but it must not force a large architecture detour. If the clean solution is to defer passive preview, document why; direct Add + canonical verification and stable UX are mandatory.

### Phase 0 acceptance tests

Add/update focused tests for at least:

```text
speed-dial actions follow symmetric layout contract
BLE-only card does not show visible Refreshing text during read/mutation pending
BLE-only card still exposes aria-busy/disabled state and errors
BLE Plug Add auto-starts exactly once and stops on unmount
candidate order remains first-seen when RSSI updates
final scan result preserves first-seen order
candidate cards have no Info button
Add is presented directly per candidate
unverified/wrong-identity candidate cannot be persisted
verified candidate can be added
saved physical device renders Added disabled
preview metrics render when available
preview failure does not block verified Add
```

Run focused Prettier/Vitest/typecheck/ESLint plus `quality:ux`, `quality:repo`, `git diff --check` as appropriate. Commit the UX slice cohesively.

**Do not run a full `pnpm check` yet solely for Phase 0.** Continue into locator resilience, then run exactly one new full gate for the combined overnight work after all focused checks are green.

---

## Phase A — stale `bleDeviceId` recovery / BLE locator resilience — SOFTWARE DONE, HARDWARE PENDING

`SavedBlePlug.bleDeviceId` is a reconnect locator, not physical identity. It may become unusable while the physical Shelly remains the same device.

Desired read-only recovery behavior:

```text
saved Plug
-> read-only BLE operation fails because saved locator cannot be used
-> one bounded Shelly BLE scan
-> inspect candidates over BLE
-> Shelly.GetDeviceInfo.id
-> match normalized canonical physicalId
-> persist refreshed bleDeviceId
-> retry the original READ once using refreshed locator
```

### Hard safety rules

1. Canonical identity only: never replace locator without matching normalized `Shelly.GetDeviceInfo.id`.
2. **No mutation replay:** never automatically retry relay/settings/script/config mutations after timeout/disconnect/ambiguous BLE failure.
3. Automatic rediscovery is for idempotent/read-only recovery only by default.
4. At most one rediscovery cycle for one failed read; no infinite loops.
5. No BLE↔Wi-Fi fallback or transport selection in this slice.
6. Preserve custom Plug name when locator/verified metadata refreshes.
7. Advertisement name/RSSI/model/gen may prioritize candidates only, never prove identity.
8. Avoid persistence migration unless clearly necessary.
9. Prefer a testable recovery service/flow with injected scan/inspect/persist dependencies; do not tightly couple low-level runtime to Zustand without architectural need.
10. Do not touch stable Wi-Fi lifecycle, `checkShellyMutation`, HTTP transport or LAN scan.

### Preimplementation audit

Inspect at least:

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

Answer from code before implementation:

- which errors reliably indicate connect/locator failure vs RPC/device failure;
- how to trigger recovery conservatively;
- which scan/radio-settle primitives can be reused from Add;
- how concurrent reads avoid duplicate rediscovery for one physical Plug;
- how store, persisted record and React Query key converge after locator replacement.

### Locator recovery acceptance behavior

- healthy locator: no scan/recovery;
- stale/unusable locator: one bounded rediscovery;
- matching canonical identity: update locator then retry read once;
- wrong candidates only: locator unchanged, explicit failure;
- scan/inspect failure: locator unchanged, explicit failure;
- custom name preserved;
- subsequent polls use refreshed locator;
- polling/refetch must not start uncontrolled recovery loops;
- relay mutation failure must never be automatically replayed.

### Locator recovery tests

Cover at minimum:

```text
healthy locator -> no rediscovery
stale locator -> matching physicalId -> locator persisted -> read retried once
wrong physicalId -> rejected -> locator unchanged
no matching candidate -> locator unchanged
scan failure -> locator unchanged
candidate inspect/GetDeviceInfo failure -> conservative bounded behavior
custom name preserved
multiple candidates -> only canonical identity match accepted
read retry bounded to one recovery cycle
relay mutation failure -> no automatic replay
recovery concurrency/single-flight if introduced
```

---

## Phase B — combined validation and overnight stretch work

After Phase 0 UX + locator resilience are both focused-green, run:

```text
focused prettier --check on all changed files
focused Vitest on all new/affected tests
pnpm --filter @lcl/mobile typecheck
focused ESLint
pnpm quality:ux
pnpm quality:repo
git diff --check
```

Fix only concrete failures; avoid broad refactors.

Then run **exactly one new**:

```text
pnpm check
```

for the combined overnight implementation.

Commit cohesive changes on `work/shelly-ble-transport` and update this handoff with exact results/checkpoints.

If all above is complete and green while the user is still away, only then perform a read-only audit of the next BLE Plug detail/settings slice. A mechanically obvious read-only detail/Info slice may be implemented with tests if it does not require product decisions. Stop before any new settings mutation.

---

# AUTONOMY / STOP CONDITIONS

While the user is away, the new chat may autonomously:

- inspect/edit code/docs on `work/shelly-ble-transport`;
- implement the Phase 0 BLE UX cleanup;
- implement read-only locator recovery;
- create focused tests;
- run local builds/tests/typecheck/lint/quality via Local Agent;
- make small cohesive commits;
- update this handoff;
- perform the read-only BLE detail/settings audit after the primary work is green.

Stop and leave a clear checkpoint instead of guessing if:

- stable Wi-Fi/HTTP lifecycle would need to change;
- canonical identity cannot be proven safely;
- destructive persistence migration becomes necessary;
- progress requires automatically replaying a mutating BLE RPC;
- pairing/bonding needs product/user interaction;
- Android system dialogs require manual interaction;
- hardware acceptance requires relay/settings mutation while the user is away;
- a refactor would broaden significantly beyond BLE UX + locator recovery + read-only detail audit.

Do not merge to `main`, delete branches, clear app data, uninstall the app, factory-reset devices or perform real-device mutations while the user is away.

## Hardware work deferred until the user returns

Software may become fully green overnight. Real locator-recovery acceptance remains for the user-present session.

Preferred later hardware acceptance:

1. use factory-fresh `shellyplugsg3-e4b063e3e298`;
2. create a controlled stale-locator condition without destroying unrelated data;
3. trigger a read-only status operation;
4. prove scan -> `GetDeviceInfo.id` match -> locator replacement -> successful status read;
5. verify canonical physical identity unchanged;
6. no relay mutation required;
7. record before/after locator and final read.

## Current next-chat instruction in one sentence

First implement and focused-validate the user-requested BLE UX polish (symmetric Add FAB actions, no visible Refreshing footer, auto-scan, stable first-seen ordering, direct Add/Added candidate cards and bounded read-only preview where cohesive), then implement conservative stale-`bleDeviceId` recovery for read-only runtime without mutation replay or Wi-Fi changes, then run one combined final `pnpm check` and leave hardware acceptance for the user.
