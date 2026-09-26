# Handoff — Shelly BLE management

Status: **2026-09-26 — BLE management foundation, stale-locator resilience, read-only Detail/Info and Add speed-dial polish accepted**

Repository: `MichalMatu/shelly-link`

Active branch: `work/shelly-ble-transport`

## Source of truth

Read in this order before changing code:

1. `AGENTS.md`;
2. nearest directory-level `AGENTS.md`;
3. `docs/ARCHITECTURE.md`;
4. `docs/ROADMAP.md`;
5. `docs/testing/hardware-matrix.md`;
6. this handoff for the current branch checkpoint.

Local Agent bindings are conversation-scoped. Always use the fresh bootstrap supplied to the active chat; never copy a binding from repository history.

## Accepted checkpoint

Technical head before this documentation cleanup:

```text
1db4d3fae8b889838cd25cba5dd4eb85b20b6fa6  Format BLE read-only recovery flow
```

Important accepted checkpoints:

```text
486db40f90ec16d9dceac7d6266eb50fdfc86064  Polish Plug add speed dial
c3ffc6667f4f35b95091c740307dc9a29dc7bbcf  Add read-only BLE Plug detail
aa3cd140e8378f5446ceefc9e8d9c172aea23fb4  Share BLE read-only locator recovery
1db4d3fae8b889838cd25cba5dd4eb85b20b6fa6  Format BLE read-only recovery flow
```

Do not rebuild these slices without a concrete defect.

## Accepted product state

- Wi-Fi/HTTP remains the stable management path and must not be refactored merely for BLE reuse.
- BLE RPC transport/framing and Android/Capacitor GATT binding are implemented.
- Bluetooth Add is independent of Wi-Fi Add and verifies canonical physical identity with normalized `Shelly.GetDeviceInfo.id`.
- `SavedBlePlug` stores canonical `physicalId` plus replaceable `bleDeviceId`; advertisement name/RSSI are metadata/prioritization only.
- BLE-only dashboard status and relay ON/OFF are accepted.
- Add Plug speed-dial uses the accepted L layout: Wi-Fi above `+`, Bluetooth left, equal distance, transport actions accented while expanded, click-away/Escape/trigger collapse, reduced-motion support.
- BLE-only Plug Detail/Info is read-only and transport-aware; it does not fake an HTTP `baseUrl`.
- Read-only dashboard runtime/status and BLE Detail/Info share the same bounded stale-locator rediscovery primitive.
- Locator replacement requires canonical `Shelly.GetDeviceInfo.id` match, persists only the refreshed BLE locator and retries the original read once.
- Relay/settings/script/config mutations are outside rediscovery and are never automatically replayed after timeout/disconnect.
- No automatic BLE↔Wi-Fi fallback or transport merging exists yet.

## Real-device evidence

Factory-fresh BLE-only Plug used for acceptance:

```text
physicalId        = shellyplugsg3-e4b063e3e298
bleDeviceId       = E4:B0:63:E3:E2:9A
advertisementName = ShellyPlugSG3-E4B063E3E298
model             = S3PL-00112EU
generation        = 3
firmwareId         = 20240820-134301/1.2.3-plugsg3prod0-gec79607
matterEnabled      = true
```

Samsung S22+ hardware acceptance passed for BLE Add/runtime and relay control with final relay OFF. Stale-locator acceptance then deliberately changed only the saved locator to `02:00:00:00:00:01`; the next read recovered through bounded BLE scan + canonical identity verification, restored `E4:B0:63:E3:E2:9A`, preserved `physicalId` and metadata, and settled at OFF / 0.0 W / about 245 V / 0 Wh. No settings mutation occurred in that recovery acceptance.

Full dated evidence belongs in `docs/testing/hardware-matrix.md`.

## Final software evidence

`shelly-ble-final-technical-gate-20260926-624` on `1db4d3fae...` passed:

- full `pnpm check`;
- repository/feature/UX gates;
- workspace typecheck/build/coverage;
- mobile Vitest **352/352**;
- canonical pre-push responsive/visual E2E **4/4**.

An earlier full-suite attempt transiently timed out three UI tests under load; an immediate diagnostic rerun passed 352/352 and the final full gate above also passed 352/352. No production change was made to hide or relax those tests.

## Safe next work

1. Audit which **read-only** Device/settings information is genuinely useful on a BLE-only Plug.
2. Add BLE settings mutations only as explicitly approved slices, preserving canonical identity verification and the no-ambiguous-retry rule.
3. Define pairing/bonding behavior only for firmware/platform combinations that require it.
4. Consider a future dual-transport representation for one physical Plug before adding automatic transport selection/fallback.
5. Keep script/config lifecycle changes separate from BLE transport work unless the product decision explicitly requires them.

The old hardware-first BLE spike journal has been retired; its durable conclusions now live in Architecture, Roadmap and the hardware matrix, while the detailed experiment history remains available in Git history.
