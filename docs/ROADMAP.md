# Roadmap

## 0. Stable baseline

Current stabilization has locked the product model and repaired the Plug lifecycle:

- canonical Shelly physical identity instead of URL-as-ID;
- actionable Add errors;
- remote-to-local managed automation recovery;
- Forget Plug distinct from Uninstall Automation;
- Climate and Time runtime identity verification before mutation;
- Climate/Time edit, LED, physical-button mode and Shelly Cloud settings retained;
- installed automation can open physical Plug settings;
- fresh-store recovery and Forget -> re-add verified on real Samsung S22+ + Shelly Plug S Gen3 with no unintended script/schedule/relay mutation.

This baseline is frozen. Do not reopen a broad refactor phase.

## 1. Automation Engine + config/data separation — DONE

The typed compact runtime-config boundary is in place and `climate-engine-v1` uses one stable runtime body across supported sensor profiles and VPD on/off. Installed 0.2.x profile-specific runtimes remain decodable for conservative recovery.

Persistent runtime config is now implemented through a capability-gated `Script.storage` channel. On supported firmware, ordinary Climate edits update config through `Script.Eval` without replacing engine code. The path validates config hash/version, survives runtime restart, participates in remote recovery and restores the previous persisted config on failed update. Firmware without the capability falls back to the compatible `Script.PutCode` path.

Real Shelly Plug S Gen3 firmware 1.7.5 smoke confirmed unchanged script bytes during config-only update and successful persisted-config reload after runtime restart. Continue measuring script/RAM footprint as new operators are added, but this stage no longer blocks product feature work.

## 2. Multiple thermometers — NEXT

Allow an automation to reference multiple thermometers with explicit aggregation such as `avg`, `min`, `max` and `firstValid`. Preserve stale-data and safe-OFF semantics when part or all of the sensor set disappears.

### Follow-up TODO — sensor provenance and Plug-side BLE visibility

- On the Plug card, distinguish readings discovered live by the Plug BLE scanner from thermometers merely saved in the mobile app.
- Do not keep showing stale sensor data just because a previously linked thermometer was removed from the app; the card should reflect what the Plug actually sees now.
- Make the source of each reading explicit (`phone BLE`, `Plug BLE`, or recovered automation/runtime).
- When recovering an existing automation from Shelly, consider importing its referenced thermometers into the app thermometer list without creating duplicates.
- Define deterministic deduplication/identity rules so the same physical thermometer discovered by phone, Plug and recovered runtime stays one logical device.

## 3. Soil moisture

Add soil-moisture inputs through the same typed sensor/config model instead of a separate runtime architecture.

## 4. Richer rule timing

Add reusable operators for clock/time windows, interval, cooldown, minimum ON, minimum OFF and condition combinations. Keep safety precedence explicit.

## 5. Advanced automation UX

Build automation list/templates and more advanced rules on the stable engine/config model. Avoid adding parallel ownership models or feature-specific runtimes when a shared operator/config path is sufficient.

## 6. BLE Shelly transport

Run a real-hardware feasibility spike first. If Shelly BLE exposes enough RPC for the required lifecycle, implement a shared `ShellyRpcTransport` and HTTP/BLE adapters. Progressively enable:

1. discovery and identity;
2. provisioning/configuration;
3. engine install/upgrade when required;
4. config-only updates;
5. status and diagnostics.

BLE must not fork automation ownership, persistence or business logic.

## Working rule

Refactor only for a concrete blocker, broken ownership or a feature that needs the boundary. Prefer small vertical slices with focused regressions, one final `pnpm check`, and real hardware acceptance when behavior touches Shelly/BLE/relay safety.
