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

Closeout is documentation consolidation, merge to `main`, stale-branch cleanup and a read-only audit of fresh `main`. Do not reopen a broad refactor phase after this point.

## 1. Automation Engine + config/data separation

The typed compact runtime-config boundary is in place, and `climate-engine-v1` now uses one stable runtime body across supported sensor profiles and VPD on/off. Installed 0.2.x profile-specific runtimes remain decodable for conservative recovery.

Next, move the compact config to a capability-gated persistent channel and define validation, config/engine versioning, upgrade behavior and rollback. Continue measuring real Shelly script/RAM limits before making the persistent path the production default.

This stage precedes further automation-generator expansion.

## 2. Multiple thermometers

Allow an automation to reference multiple thermometers with explicit aggregation such as `avg`, `min`, `max` and `firstValid`. Preserve stale-data and safe-OFF semantics when part or all of the sensor set disappears.

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
