# Architecture

Local Climate Link is a local configurator and management app. The phone discovers, configures and diagnoses devices; a Shelly Plug executes installed automation locally without requiring the phone, cloud, Home Assistant, MQTT or a 24/7 server.

## Product model

```text
physical Plug -> optional installed automation
```

A saved Plug is useful without automation. Automation setup starts from a concrete Plug. One Plug relay has at most one Local Climate Link managed automation owner at a time. Time automation is a Plug automation type, not a separate global device model.

`InstalledAutomation` is the durable record of installed automation ownership. Forgetting a Plug removes only the saved physical-device entry from the app; it does not uninstall the automation or mutate Shelly. Uninstalling an automation is a separate destructive operation.

## Identity and recovery

Shelly physical identity is `Shelly.GetDeviceInfo.id`, normalized consistently. URL/IP is transport location, not durable identity.

Before relay mutations, runtime upgrades or destructive operations, the app verifies that the endpoint still belongs to the stored Shelly device. A mismatch stops before mutation.

Remote-to-local recovery is conservative. A missing local automation may be reconstructed only when the remote script is positively recognized as a Local Climate Link managed runtime and its metadata/config can be decoded. A similar script name alone is not ownership evidence.

When Climate recovery succeeds, the configured sensor identities are passively merged into the saved Thermometers registry by physical BLE `runtimeAddress`. Existing entries and user names win, duplicate MACs are not created, current rule membership is not changed, and recovery never synthesizes live readings.

## Runtime ownership and safety

The phone owns configuration, persistence, presentation and diagnostics. Shelly owns real-time automation execution after installation.

Climate runtime invariants:

- boot starts safe OFF;
- stale/unusable sensor data fails OFF;
- destructive/runtime mutation paths verify device and managed-resource identity first;
- valid remote runtime is not silently rewritten by passive recovery;
- hardware tests finish with an explicit known relay state.

The current Climate runtime is `climate-engine-v1` with managed metadata, config hash and diagnostics. Native Time automation uses Shelly schedules rather than the Climate script.

## Dependency direction

```text
screens / routes
  -> mobile feature flows and state
    -> package APIs
      -> domain logic and adapters

shared UI -> design tokens
```

Screens do not own raw HTTP, Shelly RPC, BLE, persistence or runtime lifecycle. Side effects stay in clients/adapters/feature flows. `packages/*` never import from `apps/*`, and domain packages do not depend on React or Ionic. Repository and feature-boundary gates enforce these constraints.

Refactor only when it removes a concrete blocker, restores one clear owner or enables an agreed feature. File size is an alarm, not a reason for mechanical splitting.

## Engine and persistent config

The architecture separates stable engine code from automation-specific data:

```text
mobile automation configuration
  -> typed domain model
    -> Shelly RPC transport
      -> stable Local Climate Engine
        -> persistent runtime config/data
          -> sensors + clock
            -> rules/operators
              -> relay
```

The generator emits one `climate-engine-v1` body across supported Xiaomi/PVVX BTHome and TP357 profiles and VPD on/off. Sensor profiles, thresholds and automation-specific values live in typed compact config.

On Shelly firmware supporting `Script.storage`, ordinary Climate edits update validated persistent config through `Script.Eval` without replacing engine code. Firmware without that capability keeps the guarded compatible `Script.PutCode` path.

Persistent updates carry config hash/version, validate stored payload, update in-memory config, survive script restart and retain rollback behavior. Recovery prefers persisted config when present while retaining embedded config as compatibility fallback.

## Multiple-thermometer Climate input

A Climate automation supports **1 to 4 thermometers**. The compact runtime config keeps the ordered sensor set in `ss` and aggregation in `ag` (`avg`, `min`, `max`, `firstValid`). Xiaomi/PVVX BTHome and TP357 sensors may coexist in one set.

Freshness is evaluated independently for every member. Stale or unusable members do not contribute to the aggregate; if no configured member remains usable, safe OFF wins. Incomplete advertisements such as battery-only updates must not make old temperature data fresh.

Normalized physical BLE `runtimeAddress` is the canonical logical thermometer identity at the mobile draft/edit boundary. Phone discovery, Plug discovery, installed config and Load from Shelly converge on that identity. Recovery preserves the complete sensor set and aggregation.

The runtime exposes a compact diagnostic record per configured thermometer. Phone BLE and Plug BLE are live-reading sources; recovered/runtime identity provenance is tracked separately. Old aggregate-only diagnostics remain parseable.

Real S22+ + Shelly Plug S Gen3 firmware 1.7.5 acceptance passed with 3 TP357 + 1 Xiaomi/PVVX sensor. Exact dated evidence is kept in `docs/testing/hardware-matrix.md`.

## Plug detail UX ownership

The Plug detail screen is one product surface with five local sections:

```text
Automation | BLE | Device | Script | Info
```

They are presentation/navigation boundaries, not new ownership models:

- **Automation** presents live rule/relay state and owns inline Climate configuration editing plus automation deletion;
- **BLE** presents BLE state, devices/readings/diagnostics and is the reserved surface for future BLE capabilities;
- **Device** groups Shelly-owned settings such as LED, physical button mode and Shelly Cloud;
- **Script** presents the managed runtime source/preview and code-loading feedback only;
- **Info** presents device identity, firmware/network/health information, script/runtime resource diagnostics and destructive device-removal entry points.

Device-setting forms keep a local draft. Background refetches may refresh the server/device baseline, but must not overwrite a dirty user draft. A successful save establishes the newly confirmed device state as the next baseline.

Legacy nested Settings, Diagnostics and Script detail pages were removed after their data was moved to the correct surface. Do not reintroduce parallel nested pages for the same data.

Shared controls should use `packages/ui` + design tokens when the behavior is genuinely reusable. Product-specific layout remains in the owning mobile feature. Avoid one-off global CSS injections.

Plug detail visual hierarchy is intentional: the tab surface is flat by default; a thin framed group with an inline title is used only for a closed data/control group; `Disclosure` is reserved for optional expandable content; destructive/action separators are explicit. Styling must not infer visual separators from semantic nesting such as `section > section`, because component markup must not accidentally change page hierarchy.

## Transport direction

Current production management uses local HTTP RPC.

Two future BLE directions remain intentionally separate:

1. **BLE sensors** — additional sensor types such as soil moisture should reuse the existing typed sensor/config/diagnostic model.
2. **Shelly management over BLE** — must start with a real-hardware feasibility spike. If sufficient RPC lifecycle support exists, implement a shared `ShellyRpcTransport` with HTTP and BLE adapters rather than duplicating product logic.

BLE transport must not fork automation ownership, persistence, safety or business logic.
