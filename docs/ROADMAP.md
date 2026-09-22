# Roadmap

## 0. Stable baseline

The current product model and Plug lifecycle are stabilized:

- canonical Shelly physical identity instead of URL-as-ID;
- actionable Add errors;
- conservative remote-to-local managed automation recovery;
- Forget Plug distinct from Uninstall Automation;
- Climate and Time runtime identity verification before mutation;
- Climate/Time edit plus Plug LED, physical-button and Shelly Cloud settings retained;
- installed automations can reopen their physical Plug settings;
- fresh-store recovery, Forget -> re-add and the current multi-sensor edit/recovery path are verified on real Samsung S22+ + Shelly Plug S Gen3 without unintended script, schedule or relay mutation.

This baseline is frozen. Do not reopen a broad refactor phase. Dated hardware evidence belongs in `docs/testing/hardware-matrix.md`.

## 1. Automation Engine + config/data separation — DONE

The typed compact runtime-config boundary is in place and `climate-engine-v1` uses one stable runtime body across supported sensor profiles and VPD on/off. Installed 0.2.x profile-specific runtimes remain decodable for conservative recovery.

Persistent runtime config is implemented through a capability-gated `Script.storage` channel. On supported firmware, ordinary Climate edits update config through `Script.Eval` without replacing engine code. The path validates config hash/version, survives runtime restart, participates in remote recovery and restores the previous persisted config on failed update. Firmware without the capability falls back to the compatible `Script.PutCode` path.

Real Shelly Plug S Gen3 firmware 1.7.5 acceptance confirmed unchanged script bytes during config-only update and successful persisted-config reload after runtime restart. Continue measuring script/RAM footprint as new operators are added, but this stage no longer blocks product work.

### Follow-up option — global Shelly KVS as storage fallback

Keep `Script.storage` as the default owner-local store for automation config. If future sensor sets, operators or runtime data approach practical `Script.storage` limits, evaluate the device-level Shelly `KVS` API as an overflow or alternative persistence layer. Any move to global KVS must keep Local Climate Link data explicitly namespaced/versioned and preserve clear automation ownership, migration and uninstall/cleanup semantics.

## 2. Multiple thermometers — DONE

A Climate automation can reference up to 8 thermometers with explicit `avg`, `min`, `max` or `firstValid` aggregation. Xiaomi BTHome and TP357 sensors may be mixed in one set. Freshness is tracked per sensor: stale/unusable members are omitted, and when no configured member remains fresh the runtime fails safe OFF. Single-sensor automations remain backward compatible.

The compact runtime config stores the sensor set in `ss` and aggregation in `ag`. Recovery preserves the complete runtime sensor set and aggregation, while ordinary aggregation/sensor edits on the current 0.4 runtime use the persistent `Script.storage` / `Script.Eval` config channel rather than rewriting engine code.

The mobile draft/edit boundary uses normalized physical BLE `runtimeAddress` as the canonical thermometer identity. Phone discovery, Plug discovery, installed config and Load from Shelly converge on the same physical row. Recovered membership is tracked as persisted draft provenance scoped to the installed automation ID so it survives Edit reopen and app restart without leaking between automations. A runtime-only Edit-session flag makes the first explicit membership change stop silently carrying inherited additional sensors while keeping durable provenance intact through Back/restart; matching provenance is retired only after the updated installed automation is committed successfully; Load from Shelly remains the authoritative full-set replacement for the current session.

Real S22+ + Shelly Plug S Gen3 firmware 1.7.5 re-acceptance passed with four physical sensors, including the previously duplicated recovery case. The exact dated evidence and final safe hardware state are recorded in `docs/testing/hardware-matrix.md`.

### Current Climate slice — per-sensor diagnostics and reading provenance

Work branch: `work/per-sensor-diagnostics`.

The preimplementation architecture audit is complete. Its canonical findings, ownership map, migration requirement and test/hardware guardrails are in `docs/HANDOFF_NEXT_CHAT.md`; do not repeat the audit as a separate phase.

Implementation target:

- expose one Plug-side live diagnostic record per configured thermometer without changing aggregation/safe-OFF semantics;
- join runtime diagnostics to mobile rows only by normalized physical BLE `runtimeAddress`;
- show Phone BLE vs Plug BLE live-source provenance while keeping recovered identity provenance separate;
- remove stale indexed runtime readings when sensor membership/order changes;
- preserve backward compatibility with existing aggregate-only runtimes;
- capability-gate one-time engine upgrade of an old managed runtime on explicit Save/Edit only, never on diagnostic reads.

Finish with focused regressions, the normal repository gate, script/RAM review and dated real-device acceptance before marking this slice done.

## 3. Soil moisture

Add soil-moisture inputs through the same typed sensor/config model instead of creating a separate runtime architecture.

## 4. Richer rule timing

Add reusable operators for clock/time windows, interval, cooldown, minimum ON, minimum OFF and condition combinations. Keep safety precedence explicit.

## 5. Advanced automation UX

Build automation list/templates and more advanced rules on the stable engine/config model. Avoid adding parallel ownership models or feature-specific runtimes when a shared operator/config path is sufficient.

## 6. Shelly Script Library + simple configurators — PARALLEL TRACK

Build a curated library of useful existing Shelly scripts that Local Climate Link can present as end-user features with a simple `choose -> configure -> install/run` flow instead of exposing raw script code.

This track may use a dedicated work branch because most work should stay behind a separate script-catalog/configurator boundary. Do not fork device identity, ownership, transport, install safety or recovery rules: reuse the same Shelly client and managed-resource safeguards already used elsewhere.

For each candidate script:

1. review source, supported Shelly models/firmware and required components;
2. verify license/redistribution/attribution requirements before bundling or adapting it;
3. define a small typed configuration schema for the values a normal user should edit;
4. expose those values through a simple menu/form rather than raw JavaScript;
5. install/update through the common Shelly lifecycle with backup, identity checks and explicit ownership;
6. test on real hardware before marking that catalog entry supported.

Prefer wrapping proven upstream scripts with a thin Local Climate Link configuration layer over rewriting them without a concrete reason. Keep the catalog modular so individual scripts can be added, updated or removed independently.

## 7. BLE Shelly transport

Run a real-hardware feasibility spike first. If Shelly BLE exposes enough RPC for the required lifecycle, implement a shared `ShellyRpcTransport` and HTTP/BLE adapters. Progressively enable:

1. discovery and identity;
2. provisioning/configuration;
3. engine install/upgrade when required;
4. config-only updates;
5. status and diagnostics.

BLE must not fork automation ownership, persistence or business logic.

## Working rule

Refactor only for a concrete blocker, broken ownership or a feature that needs the boundary. Prefer small vertical slices with focused regressions, one final `pnpm check`, and real hardware acceptance when behavior touches Shelly/BLE/relay safety.

Parallel branches are fine when ownership is clearly separated and file overlap is low. Sync them from `main`, merge completed slices promptly, and avoid concurrent edits to shared lifecycle/transport files.
