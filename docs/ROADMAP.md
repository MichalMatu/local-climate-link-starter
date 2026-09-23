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

## 3. UX stabilization — IN PROGRESS / NEXT SESSION

Three UX correction slices are complete. The current candidate has been verified on representative responsive viewports and accepted on the real S22+ without clearing app data.

Completed in the current UX baseline:

- Plug detail is one surface with five local sections: Automation, BLE, Device, Script and Info;
- Automation edits Climate configuration inline, without a separate Edit page/button, while retaining live runtime/relay state;
- BLE keeps its Bluetooth status and configured sensor diagnostics in one coherent section;
- Device groups LED, physical-button mode and Shelly Cloud settings;
- LED/device controls use compact project-native checkbox rows, fixed color swatches, a styled custom-color modal and explicit field units;
- dirty Device drafts are protected from background refetches and successful saves establish the confirmed device state as the new baseline;
- Script is code-focused; script/runtime diagnostics live under Info with device diagnostics;
- redundant nested Settings/Diagnostics/Script pages remain removed;
- standalone Add Plug/Thermometer flows rely on persistent bottom navigation plus platform/browser Back and intentionally have no page-local Back control; this is enforced by tests and the UX gate;
- loading, narrow sensor selection and responsive contracts were corrected;
- Climate dashboard cards remove redundant control-mode copy and render explicit ON/OFF thresholds;
- Automation live-state copy no longer leaks raw runtime reason abbreviations, VPD Assist exposes its threshold-derived working range, and true disclosure sections share one project-level pattern;
- LED color presets use a balanced 4×2 phone layout and 8×1 wider layout;
- existing automation/runtime ownership and Shelly safety semantics were preserved.

**Next session continues UX refinement.** Work from concrete screenshots/real-device friction. Do not add Soil moisture, richer rule operators or a new transport while this UX pass is still being reviewed.

Acceptance rule for this stage: keep iterating until the existing product flows feel coherent on the real S22+ and responsive E2E remains green. Prefer small vertical corrections over broad architecture changes.

## 4. BLE soil-moisture input — AFTER UX

Add soil-moisture sensors through the existing typed sensor/config model. Do not create a parallel automation engine or device identity model.

Start with sensor discovery/identity, typed readings and diagnostics. Only then add automation behavior that has a clear product rule and safety model.

## 5. Shelly management over BLE — AFTER UX, HARDWARE SPIKE FIRST

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

Keep active work on one clearly named branch, merge completed slices promptly, and delete retired work branches after the merged `main` is re-verified.
