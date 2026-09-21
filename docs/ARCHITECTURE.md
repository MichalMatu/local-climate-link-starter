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

## Automation Engine direction

The next architectural stage separates a stable Local Climate Engine from automation data/configuration:

```text
mobile automation configuration
  -> typed domain model
    -> Shelly RPC transport
      -> stable Local Climate Engine script
        -> runtime config/data
          -> sensors + clock
            -> rules/operators
              -> relay
```

The goal is to update configuration/data without regenerating and replacing the runtime script whenever the engine itself has not changed. This separation comes before adding more generator complexity.

## Transport direction

Current production management uses local HTTP RPC. BLE is deferred until the engine/config split is stable and real hardware proves that the required Shelly RPC lifecycle is feasible.

The target transport boundary is a shared `ShellyRpcTransport` with HTTP and BLE adapters so discovery/provisioning, install/upgrade, config update, status and diagnostics can progressively work offline without duplicating product logic.
