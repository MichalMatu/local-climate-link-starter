# Architecture

Local Climate Link is a local configurator and management app. The phone discovers, configures and diagnoses devices; a Shelly Plug executes installed automation locally without requiring the phone, cloud, Home Assistant, MQTT or a 24/7 server.

## Product model

```text
physical Plug -> optional installed automation
```

A saved Plug is useful without automation. Automation setup starts from a concrete Plug. One Plug relay has at most one Local Climate Link managed automation owner at a time. Time automation is a Plug automation type, not a separate global device model.

`InstalledAutomation` is the durable record of installed automation ownership. Forgetting a Plug removes the saved physical-device entry from the app only; it does not uninstall the durable automation record and does not mutate the Shelly script. Re-adding the same physical Plug reconciles the existing automation. Uninstalling an automation is a separate destructive operation.

## Identity and recovery

Shelly physical identity is `Shelly.GetDeviceInfo.id`, normalized consistently. URL or IP is transport location, never a replacement physical identity.

Before relay mutations, runtime upgrades or destructive operations, the app verifies that the endpoint still belongs to the stored Shelly device. A mismatch must stop before mutation.

Remote-to-local recovery is conservative. A missing local automation may be reconstructed only when the remote script is positively recognized as a Local Climate Link managed runtime and its metadata/config can be decoded. A similar script name alone is not ownership evidence.

## Runtime ownership and safety

The phone owns configuration, persistence, presentation and diagnostics. Shelly owns real-time automation execution after installation.

Climate runtime safety invariants:

- boot starts safe OFF;
- stale or unusable sensor data fails OFF;
- destructive/runtime mutation paths verify device and managed-resource identity first;
- final relay state after hardware tests is explicit and known;
- app recovery must not silently rewrite a valid remote runtime.

The current climate runtime is a generated Local Climate Link Shelly Script with managed metadata, config hash and diagnostics. Native Time automation uses Shelly schedules rather than the climate script.

## Dependency direction

```text
screens / routes
  -> mobile feature flows and state
    -> package APIs
      -> domain logic and adapters

shared UI -> design tokens
```

Screens do not own raw HTTP, Shelly RPC, BLE, persistence or runtime lifecycle. Side effects stay in clients/adapters/feature flows. `packages/*` never import from `apps/*`, and domain packages do not depend on React or Ionic. Repository and feature-boundary gates enforce these constraints.

Refactor only when it removes a concrete blocker, restores one clear owner, or enables an agreed feature. File size is an alarm, not a reason for mechanical splitting.

## Automation Engine and persistent config

The current architecture separates a stable Local Climate Engine from automation data/configuration:

```text
mobile automation configuration
  -> typed domain model
    -> Shelly RPC transport
      -> stable Local Climate Engine script
        -> persistent runtime config/data
          -> sensors + clock
            -> rules/operators
              -> relay
```

The climate generator emits one `climate-engine-v1` runtime body across the supported Xiaomi BTHome and TP357 sensor profiles and across VPD on/off. Sensor-profile selection, thresholds and other automation-specific values live in the typed compact runtime config. The decoder still recognizes installed 0.2.x profile-specific runtimes for conservative recovery.

On Shelly firmware that supports `Script.storage`, ordinary Climate edits update only the validated persistent runtime config through `Script.Eval`; they do not replace the engine code. The client probes this capability explicitly. Firmware without the storage capability keeps the compatible `Script.PutCode` path instead of assuming support.

Persistent updates carry the config hash/version, validate the stored payload, update the running in-memory config, survive script restart and retain rollback to the previous persisted config when an update fails. Recovery prefers the persisted config when present while retaining embedded config as the compatibility fallback.

Real Plug S Gen3 acceptance on firmware 1.7.5 confirmed that a config-only update changes effective runtime values while script bytes remain unchanged, and that the persisted config is loaded again after runtime restart.

## Multiple-thermometer climate input

A Climate automation may reference 1 to 8 thermometers. The compact runtime config keeps the ordered sensor set in `ss` and the aggregation operator in `ag` (`avg`, `min`, `max`, `firstValid`). The primary sensor remains the compatibility anchor for older single-sensor records, but runtime evaluation uses the complete configured set. Xiaomi BTHome and TP357 profiles may coexist in one set.

Freshness is evaluated independently for every member. A stale or unusable member contributes nothing to the aggregate; if every configured member is stale/unusable, the existing safe-OFF invariant wins. Incomplete advertisements such as battery-only updates must not make an old temperature sample fresh or advance rule hit counters.

Current 0.4 runtimes persist sensor-set and aggregation edits through the same validated `Script.storage` config channel as other Climate edits. Recovery reads the effective persisted config first and reconstructs the full sensor set and aggregation without requiring an engine rewrite. Installed legacy managed runtimes may require one guarded `Script.PutCode` upgrade before they gain this config shape; later edits remain config-only.

For the current BLE thermometer profiles, normalized physical `runtimeAddress` is the canonical logical identity at the mobile draft/edit boundary. Phone discovery, Plug-side discovery and Load from Shelly already produce that address; edit reconstruction now uses the same identity instead of treating config `sensorId` as a second device key. Config validation continues to enforce unique runtime addresses, so provenance metadata cannot create another logical row for the same physical BLE device.

Recovery still reconstructs the complete runtime sensor membership. The existing recovery contract writes `sensorId = runtimeAddress`; edit uses that deterministic marker, plus configured-only membership, as inherited-selection provenance persisted in the v9 setup draft so it survives Edit reopen and app restart. Ordinary non-sensor edits preserve recovered membership unchanged. Once the user explicitly changes sensor membership, inherited additional sensors are not carried forward unless they are explicitly selected again. Load from Shelly is an explicit full-set replacement and therefore restores every runtime sensor and clears inherited-selection provenance. This changes only mobile draft/edit semantics; runtime `ss`, `ag`, freshness and safety behavior are unchanged.

Regression tests cover the previously observed 7-row duplication, recovered `A4:C1:38:4F:24:CD` surviving a prior draft, full multi-sensor recovery and full-set Load from Shelly. Real Samsung S22+ + Shelly Plug S Gen3 firmware 1.7.5 re-acceptance passed on 2026-09-22; exact dated evidence and final hardware state are kept in `docs/testing/hardware-matrix.md`.

## Transport direction

Current production management uses local HTTP RPC. BLE is deferred until real hardware proves that the required Shelly RPC lifecycle is feasible.

The target transport boundary is a shared `ShellyRpcTransport` with HTTP and BLE adapters so discovery/provisioning, install/upgrade, config update, status and diagnostics can progressively work offline without duplicating product logic.
