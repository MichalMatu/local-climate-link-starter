# Architecture

Shelly Link is a local configurator and management app. The phone discovers, configures and diagnoses devices; a Shelly Plug executes installed automation locally without requiring the phone, cloud, Home Assistant, MQTT or a 24/7 server.

## Product model

```text
physical Plug -> optional installed automation
```

A saved Plug is useful without automation. Automation setup starts from a concrete Plug. One Plug relay has at most one Shelly Link managed automation owner at a time. Time automation is a Plug automation type, not a separate global device model.

`InstalledAutomation` is the durable record of installed automation ownership. Forgetting a Plug removes only the saved physical-device entry from the app; it does not uninstall the automation or mutate Shelly. Uninstalling an automation is a separate destructive operation.

The project is pre-release. Development-only persisted state, script names and internal APIs do not receive backward-compatibility adapters. A rename or model change is applied cohesively to current code/tests/docs; obsolete compatibility paths are deleted.

## Identity and recovery

Shelly physical identity is normalized `Shelly.GetDeviceInfo.id`.

Transport locators are not identity:

- Wi-Fi IP / `baseUrl` is a Wi-Fi locator;
- Android BLE address / CoreBluetooth UUID / saved `bleDeviceId` is a BLE reconnect locator;
- advertisement name is discovery metadata only.

Before relay mutations, runtime replacement or destructive operations, the app verifies that the endpoint still belongs to the stored Shelly device. A mismatch stops before mutation.

On a Shelly Link-managed Plug, the application owns the full Shelly Scripts namespace. Script name, old script hash and previously stored script id are not authorization evidence and do not block install/edit/recover/delete. Explicit automation mutation first confirms physical device identity and safe OFF, then converges the device to the current application state.

Remote-to-local recovery may reconstruct a missing Climate installation when the single enabled runtime can be decoded as the current generated Climate runtime and its metadata/config is valid. Script display name is not ownership evidence. Passive reconciliation may report changed/unavailable state but does not rewrite the device; explicit recover/edit is the convergence boundary.

When Climate recovery succeeds, the configured sensor identities are passively merged into the saved Thermometers registry by physical BLE `runtimeAddress`. Existing entries and user names win, duplicate MACs are not created, current rule membership is not changed, and recovery never synthesizes live readings.

## Runtime ownership and safety

The phone owns configuration, persistence, presentation and diagnostics. Shelly owns real-time automation execution after installation.

Climate runtime invariants:

- boot starts safe OFF;
- stale/unusable sensor data fails OFF;
- destructive/runtime mutation paths verify physical device identity first;
- install/edit/recover force the relay OFF, stop/delete every existing Shelly script, install exactly one current Climate runtime, verify it, then persist its new script id/hash;
- uninstall forces the relay OFF, stops/deletes every Shelly script and confirms an empty script list before removing the local automation record;
- script hashes describe generated code only; display-name changes must not change runtime identity;
- hardware tests finish with an explicit known relay state.

Temporary BLE discovery is the one non-exclusive script flow. It is short-lived, uses run-on-boot disabled, pauses the enabled automation while scanning, deletes its discovery script when finished and restores the automation when requested. It must not redefine the automation lifecycle ownership model.

The current Climate runtime is `climate-engine-v1` with managed metadata, config hash and diagnostics. Native Time automation uses Shelly schedules rather than the Climate script.

Shelly script status is intentionally read from script-specific RPCs. `Shelly.GetStatus` exposes created script slots under dynamic keys such as `script:1`; it is not a global Scripts capability flag and must not be interpreted through a synthetic `status.script` field. Use successful `Script.List` to establish script-management availability/listing and `Script.GetStatus` for the state of a concrete runtime.

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
      -> stable Climate engine
        -> persistent runtime config/data
          -> sensors + clock
            -> rules/operators
              -> relay
```

The generator emits one `climate-engine-v1` body across supported Xiaomi/PVVX BTHome and TP357 profiles and VPD on/off. Sensor profiles, thresholds and automation-specific values live in typed compact config.

`Script.storage` remains a runtime persistence mechanism where firmware supports it, but the mobile edit lifecycle intentionally does not preserve development-era engine instances through config-only mutation. During pre-release development every explicit Climate edit replaces the script runtime using the current generator and stores the returned script id plus a code-only hash. This keeps device state deterministic and prevents stale script identity/name/history from becoming a compatibility surface.

Recovery reads persisted config when present while retaining embedded config as the generator/runtime decoding fallback for the current development build. No compatibility promise is made to never-released historical script formats.

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

Wi-Fi and Bluetooth are independent management/add transports for the same physical Shelly Plug. Neither transport owns product identity or automation ownership.

The shared transport boundary is:

```text
product/feature flow
  -> RpcShellyClient / ShellyRpcTransport
      -> HTTP adapter
      -> BLE adapter
```

Current state:

- local HTTP RPC remains the stable Wi-Fi management path;
- BLE RPC framing, chunking, timeout handling, serialization and the mobile GATT binding are implemented and have real-hardware evidence;
- BLE-only add flow verifies normalized `Shelly.GetDeviceInfo.id` and persists a separate `SavedBlePlug` keyed by physical identity;
- the BLE-only dashboard runtime/status/relay slice is accepted and remains the BLE management baseline;
- read-only BLE recovery treats `bleDeviceId` as a replaceable locator across dashboard runtime/status and BLE Detail/Info: retryable offline/timeout reads may perform one bounded scan, accept only a normalized `Shelly.GetDeviceInfo.id` match, persist the refreshed locator and retry the original read once; concurrent recovery for one physical Plug is single-flight;
- mutating BLE RPC stays outside locator recovery and is never automatically replayed after an ambiguous failure;
- no automatic BLE↔Wi-Fi fallback or transport merging is implemented yet.

`SavedBlePlug` must not be forced into HTTP `ShellyDraftDevice` with a fake `baseUrl`. A future dual-transport record may represent both locators for one physical Plug, but canonical identity remains normalized `Shelly.GetDeviceInfo.id` and transport selection must stay separate from business logic.

Mutating BLE RPC is never blindly retried after timeout/disconnect because the remote mutation result may be ambiguous.

BLE sensor support remains a separate concern from Shelly management over BLE. New sensor types should continue to reuse the typed sensor/config/diagnostic model rather than coupling sensor discovery to the Plug management transport.
