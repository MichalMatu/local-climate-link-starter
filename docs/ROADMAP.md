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

### Follow-up option — global Shelly KVS as storage fallback

Keep `Script.storage` as the default owner-local store for automation config. If future sensor sets, operators or runtime data approach practical `Script.storage` limits, evaluate the device-level Shelly `KVS` API as an overflow or alternative persistence layer. Any move to global KVS must keep Local Climate Link data explicitly namespaced/versioned and preserve clear automation ownership, migration and uninstall/cleanup semantics instead of silently spreading script-owned state across device-global storage.

## 2. Multiple thermometers — DONE

Climate automation can reference up to 8 thermometers with explicit `avg`, `min`, `max` or `firstValid` aggregation. Xiaomi BTHome and TP357 sensors may be mixed in one set. Freshness is tracked per sensor: stale/unusable members are omitted, and when no configured member remains fresh the runtime fails safe OFF. Single-sensor automations remain backward compatible.

The compact runtime config stores the sensor set in `ss` and aggregation in `ag`. Recovery preserves the complete runtime sensor set and aggregation, while ordinary aggregation/sensor edits on the current 0.4 runtime use the persistent `Script.storage` / `Script.Eval` config channel rather than rewriting engine code.

Real Samsung S22+ + Shelly Plug S Gen3 firmware 1.7.5 acceptance covered a one-time installed-runtime upgrade from 0.2.0 to 0.4.0, all four aggregation modes, persistent config-only edits with unchanged script SHA-256 `8acb3f2e2b02936e07b960921fce25ab57004139e021ccc5e4e18f07acf2fe41`, one-sensor stale omission and recovery after BLE resumes. Final hardware state was Average, 4/4 configured sensors fresh, script running, relay OFF and no Shelly schedules.

### Follow-up TODO — sensor provenance and Plug-side BLE visibility

- On the Plug card, distinguish readings discovered live by the Plug BLE scanner from thermometers merely saved in the mobile app.
- Do not keep showing stale sensor data just because a previously linked thermometer was removed from the app; the card should reflect what the Plug actually sees now.
- Make the source of each reading explicit (`phone BLE`, `Plug BLE`, or recovered automation/runtime).
- Extend the Climate runtime `/diag` contract to expose **per configured sensor** live diagnostics, not only the current primary/aggregate-style snapshot: normalized runtime address, temperature, humidity, battery, RSSI, last-seen/age and stale/fresh state. The mobile rule editor should map those records back to each thermometer row and show whether its displayed values come from the phone or from the selected Shelly, so a 3–8 sensor automation can display independent Plug-side live values for every member.
- When recovering an existing automation from Shelly, consider importing its referenced thermometers into the app thermometer list without creating duplicates.
- DONE on `work/ux-sensor-cleanup`: the current BLE thermometer draft/edit boundary uses normalized physical `runtimeAddress` as the canonical logical identity across phone discovery, Plug discovery, installed config and Load from Shelly. Config `sensorId` is no longer used as a second UI/device identity, so the same physical thermometer cannot create parallel logical rows only because one source supplied `sensor-<mac>` and another supplied the BLE address.
- DONE on `work/ux-sensor-cleanup`: edit still reconstructs the complete configured/recovered runtime membership initially, but membership identified by the existing recovery contract (`sensorId === runtimeAddress`) or present only through installed config is tracked as inherited. Once the user explicitly changes sensor membership, inherited additional sensors are not silently carried forward; an explicit Load from Shelly still replaces the draft with the complete runtime sensor set.
- Regression coverage reproduces the hardware-acceptance failure where 3 phone TP357s plus recovered `A4:C1:38:4F:24:CD` produced 7 edit rows and a 4-sensor save. Tests now cover 4 unique physical candidates, the previously persisted recovery-row variant, full runtime recovery and full-set Load from Shelly. Real Samsung S22+ + Shelly Plug S Gen3 re-acceptance is still required before this follow-up is considered hardware-confirmed.

## 3. Soil moisture

Add soil-moisture inputs through the same typed sensor/config model instead of a separate runtime architecture.

## 4. Richer rule timing

Add reusable operators for clock/time windows, interval, cooldown, minimum ON, minimum OFF and condition combinations. Keep safety precedence explicit.

## 5. Advanced automation UX

Build automation list/templates and more advanced rules on the stable engine/config model. Avoid adding parallel ownership models or feature-specific runtimes when a shared operator/config path is sufficient.

## 6. Shelly Script Library + simple configurators — PARALLEL TRACK

Build a curated library of useful existing Shelly scripts that Local Climate Link can present as end-user features with a simple `choose -> configure -> install/run` flow instead of exposing raw script code.

This track may be developed in parallel with the core Climate/automation roadmap on a dedicated work branch because most work should stay behind a separate script-catalog/configurator boundary. Do not fork device identity, ownership, transport, install safety or recovery rules: reuse the same Shelly client and managed-resource safeguards already used elsewhere.

For each candidate script:

1. review source, supported Shelly models/firmware and required components;
2. verify its license/redistribution/attribution requirements before bundling or adapting it;
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

Parallel branches are allowed when they have clearly separated ownership and low file overlap. Keep one branch focused on core automation/UX cleanup and a second branch focused on the Shelly Script Library. Rebase/sync both from `main` regularly, merge small completed slices quickly, and avoid concurrent edits to shared lifecycle/transport files unless one track waits for the other.
