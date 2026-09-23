# Roadmap

## 0. Stable baseline — DONE

The product model and Plug lifecycle are stabilized:

- physical Shelly identity is canonical; URL/IP is transport only;
- a saved Plug is useful with or without automation;
- Forget Plug is distinct from Uninstall Automation;
- Climate and Time verify runtime/device identity before mutation;
- the phone configures/manages/diagnoses while Shelly executes installed automation locally;
- recovery is conservative and must not silently rewrite a valid managed runtime;
- real Samsung S22+ + Shelly Plug S Gen3 acceptance exists for the current lifecycle, engine, recovery and multi-sensor paths.

This baseline is frozen. Refactor only for a concrete blocker, broken ownership or an agreed feature boundary.

## 1. Automation Engine + persistent config — DONE

`climate-engine-v1` uses one stable runtime body with typed compact config. Supported firmware uses validated `Script.storage` + `Script.Eval` for config-only edits; compatible firmware can fall back to the guarded `Script.PutCode` path.

Real Plug S Gen3 firmware 1.7.5 acceptance confirmed unchanged script bytes during config-only updates and successful persisted-config reload after runtime restart.

If future config/data outgrows practical `Script.storage` limits, evaluate Shelly KVS only as a namespaced/versioned overflow or alternative store. Do not fork ownership or cleanup semantics.

## 2. Multiple thermometers + per-sensor diagnostics — DONE

A Climate automation supports **1 to 4 thermometers** with `avg`, `min`, `max` or `firstValid` aggregation. Xiaomi/PVVX BTHome and TP357 sensors may be mixed. Freshness is evaluated per sensor and no usable member means safe OFF.

The runtime exposes compact diagnostics per configured sensor. Phone BLE and Plug BLE are live-reading sources; recovered/runtime identity provenance is tracked separately. Mobile identity joins through normalized physical BLE `runtimeAddress`.

Real S22+ + Shelly Plug S Gen3 firmware 1.7.5 acceptance passed with 3 TP357 + 1 Xiaomi/PVVX sensor. The accepted four-sensor runtime generated at 7929 bytes and exposed four independent diagnostic records. Dated evidence is in `docs/testing/hardware-matrix.md`.

## 3. UX stabilization — DONE

The UX pass is accepted on the real S22+ and closed. Reopen it only for a concrete new defect or explicitly requested product change.

Accepted baseline:

- Plug detail is one surface with five local sections: Automation, BLE, Device, Script and Info;
- Automation edits Climate configuration inline while retaining live runtime/relay state;
- BLE keeps Bluetooth state, configured sensor diagnostics and scan controls together;
- Device groups LED, physical-button mode and Shelly Cloud settings;
- dirty Device drafts are protected from background refetches;
- Script is code-focused; script/runtime diagnostics live under Info;
- nested duplicate Settings/Diagnostics/Script pages remain removed;
- Add Plug/Thermometer flows intentionally rely on persistent bottom navigation plus platform/browser Back;
- Automation live-state copy does not leak raw runtime reason abbreviations;
- VPD Assist configuration exposes its threshold-derived working range without changing the existing runtime clamp;
- true disclosure sections share one project-level pattern;
- LED presets use balanced 4×2 phone and 8×1 wider layouts;
- Plug detail hierarchy is explicit: flat tab surface by default, framed groups only for closed groups, Disclosure only for optional content and no separators inferred from semantic nesting;
- Automation, BLE, Script and Info no longer carry legacy stray separators/loose controls, while Device keeps the compact flat-plus-framed-subgroup pattern;
- dashboard metric labels that are obvious from `%` / `°C` are visually omitted while accessible names remain;
- dashboard ON/OFF thresholds stay on one compact line, use the user's configured rule limits rather than VPD-derived effective runtime thresholds, and humidity thresholds display as whole percentages;
- dashboard VPD keeps the simple accepted `current → target kPa` presentation when Assist is enabled; do not add target humidity, dynamic VPD bands or extra explanatory copy to the card without explicit product intent;
- existing automation/runtime ownership and Shelly safety semantics were preserved.

Final dashboard correction `349446f86f6d63c37ececa439ec12ef826b06d2f` passed full `pnpm check:full` and was installed on Samsung SM-S906B / Android 16 with app data preserved. The final real-device state was accepted by the user.

## 4. BLE soil-moisture input — NEXT

Add soil-moisture sensors through the existing typed sensor/config model. Do not create a parallel automation engine or device identity model.

Start with sensor discovery/identity, typed readings and diagnostics. Only then add automation behavior that has a clear product rule and safety model.

## 5. Shelly management over BLE — AFTER SOIL-MOISTURE, HARDWARE SPIKE FIRST

Run a real-hardware feasibility spike before product implementation. Determine which Shelly RPC lifecycle operations are genuinely available/reliable over BLE.

If feasible, implement a shared `ShellyRpcTransport` boundary with HTTP and BLE adapters. Progressively enable:

1. discovery and identity;
2. provisioning/configuration;
3. status and diagnostics;
4. config-only automation updates;
5. engine install/upgrade only when the transport proves safe enough.

BLE must not fork automation ownership, persistence or business logic.

The BLE sensor track and Shelly-over-BLE transport track are separate concerns even though both use Bluetooth.

## 6. Richer rule timing — LATER

Add reusable operators for clock/time windows, interval, cooldown, minimum ON, minimum OFF and condition combinations. Keep safety precedence explicit.

## 7. Advanced automation UX — LATER

Build templates/list management and more advanced rules on the stable engine/config model. Avoid feature-specific runtime forks where shared operators/config are sufficient.

## 8. Shelly Script Library + simple configurators — PARALLEL OPTIONAL TRACK

A curated script catalog may expose useful Shelly scripts through a simple `choose -> configure -> install/run` flow. Reuse the same identity, ownership, transport, install-safety and recovery rules.

For each script: verify source/license, supported models/firmware, define a small typed config, keep raw JavaScript out of the normal user flow, and require real-hardware acceptance before marking it supported.

## Working rule

Prefer small vertical slices, focused regressions and one final full repository gate. Use `pnpm check:full` whenever responsive E2E is part of the acceptance surface. Hardware-facing behavior requires real-device acceptance and an explicit final relay state.

Keep active work on one clearly named branch, merge completed slices promptly, and delete retired work branches after the merged `main` is re-verified. Preserve intentionally parked branches from separate tracks instead of deleting them as incidental cleanup.
