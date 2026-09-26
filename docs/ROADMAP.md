# Roadmap

## 0. Stable baseline — DONE

The product model and Plug lifecycle are stabilized:

- physical Shelly identity is canonical; transport locators are not identity;
- a saved Plug is useful with or without automation;
- Forget Plug is distinct from Uninstall Automation;
- Climate and Time verify runtime/device identity before mutation;
- the phone configures/manages/diagnoses while Shelly executes installed automation locally;
- recovery is conservative and must not silently rewrite a valid managed runtime;
- real Samsung S22+ + Shelly Plug S Gen3 acceptance exists for the current lifecycle, engine, recovery and multi-sensor paths.

This baseline is frozen. Refactor only for a concrete blocker, broken ownership or an agreed feature boundary.

## 1. Automation Engine + persistent config — DONE

`climate-engine-v1` remains the stable runtime/config contract. Climate install, edit and repair use one exclusive Shelly Script lifecycle: verify the physical Plug identity, confirm or force the relay OFF, delete every existing Shelly Script, then create and start a fresh managed runtime. Script IDs are intentionally not preserved across replacement.

Recovery remains conservative: only recognized managed runtime markers plus decodable managed metadata/config establish ownership, and passive recovery must not rewrite an already valid managed runtime.

If future config/data outgrows the current managed runtime/config model, evaluate Shelly KVS only as a namespaced/versioned storage option. Do not fork ownership, replacement or cleanup semantics.

## 2. Multiple thermometers + per-sensor diagnostics — DONE

A Climate automation supports **1 to 4 thermometers** with `avg`, `min`, `max` or `firstValid` aggregation. Xiaomi/PVVX BTHome and TP357 sensors may be mixed. Freshness is evaluated per sensor and no usable member means safe OFF.

The runtime exposes compact diagnostics per configured sensor. Phone BLE and Plug BLE are live-reading sources; recovered/runtime identity provenance is tracked separately. Mobile identity joins through normalized physical BLE `runtimeAddress`.

Real S22+ + Shelly Plug S Gen3 firmware 1.7.5 acceptance passed with 3 TP357 + 1 Xiaomi/PVVX sensor. Dated evidence is in `docs/testing/hardware-matrix.md`.

## 3. UX stabilization + screenshot closeout — DONE

The broad UX pass and the final real-phone screenshot closeout are accepted on the S22+. Reopen UX only for a concrete new defect or explicitly requested product change.

Accepted baseline:

- Plug detail is one surface with five local sections: Automation, BLE, Device, Script and Info;
- Automation edits Climate configuration inline while retaining live runtime/relay state;
- BLE keeps Bluetooth state, configured sensor diagnostics and scan controls together;
- Device groups LED, physical-button mode and Shelly Cloud settings;
- dirty Device drafts are protected from background refetches;
- Script is code-focused; script/runtime diagnostics live under Info;
- nested duplicate Settings/Diagnostics/Script pages remain removed;
- Add Plug/Thermometer flows intentionally rely on persistent bottom navigation plus platform/browser Back;
- VPD Assist configuration exposes its threshold-derived working range without changing the runtime clamp;
- true disclosure sections share one project-level pattern;
- LED presets use balanced 4×2 phone and 8×1 wider layouts;
- framed-section inline titles use one consistent border-crossing/background-mask treatment;
- dashboard ON/OFF thresholds stay on one compact line and use the user's configured rule limits;
- dashboard VPD keeps the simple accepted `current → target kPa` presentation when Assist is enabled;
- the Model row contains only model identity/generation, not the redundant `CHECK` / `COMPATIBLE` badge;
- script diagnostics use `Script.List` for script-management availability and `Script.GetStatus` for a concrete runtime; `Shelly.GetStatus` is not treated as exposing a synthetic global `status.script`;
- existing automation/runtime ownership and Shelly safety semantics remain unchanged.

Final screenshot-closeout commit `4383182be09a8e8c6ffecd1c1effed0fd837216e` passed the full pre-push gate (`pnpm check` plus canonical visual E2E), was installed on Samsung SM-S906B / Android 16 with `adb install -r` preserving app data, and the user accepted the resulting Device/Info presentation.

## 4. TP357 battery decoding compatibility — DONE

The battery-reporting defect was reproduced and resolved from real BLE evidence.

The implementation treats byte 4 as a bitfield and maps its low-two-bit state as `0 -> 1%`, `1 -> 50%`, `2 -> 100%`; state `3` is unknown without discarding valid temperature/humidity. The same semantics are applied in:

- `packages/ble-core/src/parsers/tp357.ts`;
- `packages/script-generator/src/shelly/generate.ts`;
- `packages/script-generator/src/shelly/discoveryParsing.ts`.

Regression coverage uses captured six-byte TP357 and seven-byte TP357S frames. Enclosure color is not used as a protocol discriminator.

## 5. Shelly management over BLE — FOUNDATION DONE / EXPANSION IN PROGRESS

The BLE management foundation, independent BLE Add/persistence and BLE-only dashboard runtime are implemented and accepted.

Done in this track:

- official Shelly BLE RPC framing and UUIDs;
- multi-chunk response handling, request-id validation, size limits and serialized RPC calls;
- timeout/abort handling and connection invalidation;
- no automatic retry of ambiguous mutating RPC;
- `BleShellyRpcTransport` behind the existing `ShellyRpcTransport` boundary;
- mobile GATT binding through the existing Capacitor BLE client;
- real Samsung S22 + Shelly Plug S Gen3 identity/status/relay evidence;
- independent Bluetooth Add flow using `Shelly.GetDeviceInfo.id` as canonical physical identity;
- polished Add Plug speed-dial with aligned Wi-Fi-above / Bluetooth-left geometry, explicit expanded-state hierarchy, click-away/Escape collapse and reduced-motion support;
- separate BLE-only persistence through `SavedBlePlug`, keyed by physical identity rather than BLE locator;
- BLE-only dashboard status/relay runtime with explicit read/mutation state and no fake HTTP `baseUrl`;
- focused software validation, one full `pnpm check`, and real Samsung S22 saved-runtime acceptance on 2026-09-26;
- factory-fresh Plug `shellyplugsg3-e4b063e3e298` accepted with BLE status read and final stable `relayOn=false` after manual relay exercise.

### BLE locator resilience — DONE

Read-only stale-locator recovery is implemented, shared by dashboard runtime/status and BLE Detail/Info, and hardware-accepted on `work/shelly-ble-transport`:

- normal reads use the saved locator without scanning;
- only retryable BLE `shelly-offline` / `timeout` read failures may start one bounded rediscovery cycle;
- advertisement name and RSSI only prioritize candidates; normalized `Shelly.GetDeviceInfo.id` is the acceptance identity;
- a matching candidate replaces only `bleDeviceId`, preserving the user's custom Plug name, then retries the original read exactly once;
- concurrent recovery for one physical Plug is single-flight;
- wrong identity, no match, scan failure and inspection failure never replace the locator;
- relay/settings/script/config mutations are not automatically replayed;
- BLE↔Wi-Fi fallback remains out of scope.

Focused recovery validation passed 4 Vitest files / 23 tests, mobile typecheck, focused Prettier/ESLint, `quality:ux`, `quality:repo` and `git diff --check`. Combined BLE UX + recovery validation passed 10 Vitest files / 46 tests plus the existing responsive Plug-route Playwright test at all five canonical viewports.

Real Samsung S22+ stale-locator acceptance passed on 2026-09-26 using factory-fresh Plug `shellyplugsg3-e4b063e3e298`. The saved locator was deliberately changed from `E4:B0:63:E3:E2:9A` to stale `02:00:00:00:00:01`; the read-only runtime path recovered through BLE scanning/canonical identity verification, persisted `E4:B0:63:E3:E2:9A` again, preserved `physicalId` and saved metadata, and settled to a successful `0.0 W / 245 V / 0 Wh` read with relay OFF, controls enabled and no alerts. No relay toggle or settings mutation was performed. Android Bluetooth logs showed the recovery scan followed by successful GATT reconnects to the target address suffix `E2:9A`.

### Read-only BLE Plug detail / Info — DONE

A narrow verified read-only management boundary now supports both Wi-Fi and BLE without changing the existing Wi-Fi-shaped `PlugSettingsTarget` or introducing a fake HTTP target. BLE reads verify normalized `Shelly.GetDeviceInfo.id` against the saved canonical `physicalId`, and the BLE transport is disconnected in `finally`.

The accepted UI slice adds a BLE-only read-only Plug detail route from the dashboard card and keeps presentation transport-aware:

- common Info rows remain shared;
- Wi-Fi detail keeps `baseUrl` and Wi-Fi RSSI behavior;
- BLE detail shows the BLE reconnect locator plus advertisement name instead of Wi-Fi-only rows;
- BLE-only detail omits installed-runtime resource rows;
- no LED/button/Cloud/script/config mutation surface was added;
- no automatic retry of ambiguous mutations was introduced;
- new capability code lives behind feature boundaries (`features/plugs` and `features/dashboard`) while app routing remains composition-only.

Accepted commit `c3ffc6667f4f35b95091c740307dc9a29dc7bbcf` passed focused typecheck/Vitest/ESLint and the repository pre-push gate. Follow-up `aa3cd140e8378f5446ceefc9e8d9c172aea23fb4` extracted one shared locator-rediscovery flow for runtime/status and Detail/Info without adding mutation retry; `1db4d3fae8b889838cd25cba5dd4eb85b20b6fa6` is its formatting checkpoint. Final technical gate `shelly-ble-final-technical-gate-20260926-624` passed full `pnpm check` with 352/352 mobile tests and all four canonical pre-push E2E scenarios.

Safe next work:

1. audit which **read-only** Device/settings information is worth exposing over BLE, if any;
2. implement settings mutations only when explicitly approved, preserving canonical identity verification and the no-ambiguous-retry rule;
3. pairing/bonding policy for firmware that requires it;
4. optional dual-transport representation for one physical Plug;
5. optional transport selection/fallback policy.

The existing Wi-Fi/HTTP path remains stable and must not be refactored merely to make BLE reuse easier.

## 6. Shelly Script Library + simple configurators — LATER

The former BLE-runtime prerequisite is satisfied, but this track is not active while BLE management expansion remains the current focus.

A curated script catalog may expose useful official/approved Shelly scripts through a simple `choose -> configure -> install/run` flow. Reuse the same identity, ownership, transport, install-safety and recovery rules.

For each script: verify source/license, supported models/firmware, define a small typed config, keep raw JavaScript out of the normal user flow, and require real-hardware acceptance before marking it supported.

Do not add arbitrary unmanaged scripts alongside a Shelly Link-managed automation without first redesigning the current exclusive Shelly Scripts ownership model.

## 7. History / datalogger redesign and port — PARKED

Preserve `work/kvs-datalogger` as source material, but do not rebase-and-merge it mechanically. Its parked design uses a second long-lived Shelly script and predates the current exclusive Shelly Scripts ownership model.

When this track resumes, first choose a lifecycle compatible with current ownership, then port only still-valid KVS/codec/client/generator pieces. Re-establish software coverage, KVS capacity behavior, runtime ownership guarantees and real Plug S Gen3 memory/hardware acceptance before merge. Climate safety must remain independent of History failure.

## 8. Richer rule timing — LATER

Add reusable operators for clock/time windows, interval, cooldown, minimum ON, minimum OFF and condition combinations. Keep safety precedence explicit.

## 9. Advanced automation UX — LATER

Build templates/list management and more advanced rules on the stable engine/config model. Avoid feature-specific runtime forks where shared operators/config are sufficient.

## 10. BLE soil-moisture input — DEFERRED

Soil-moisture support is intentionally off the active near-term path. If resumed later, add sensors through the existing typed sensor/config/diagnostic model; do not create a parallel automation engine or identity model. Start with discovery/identity, typed readings and diagnostics before adding any automation rule with a clear safety model.

## Working rule

Prefer small vertical slices, focused regressions and one final full repository gate. Use `pnpm check:full` whenever responsive E2E is part of the acceptance surface. Hardware-facing behavior requires real-device acceptance and an explicit final relay state when a relay mutation is exercised.

Keep active work on one clearly named branch, merge completed slices promptly, and delete retired work branches after the merged `main` is re-verified. Preserve intentionally parked branches from separate tracks instead of deleting them as incidental cleanup.
