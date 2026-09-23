# KVS datalogger implementation plan

Status: design/research only — no production implementation yet  
Branch: `work/kvs-datalogger`  
Base at creation: `main` (`677624603a42adea9e3030ce337ebeb7f0d68c14`)  
Date: 2026-09-23

## Goal

Add a local short-term history/datalogger for a physical Shelly Plug. The Shelly stores recent data in its own KVS, so logging continues without the phone, cloud, MQTT, Home Assistant or another always-on server.

The user-facing surface belongs in Plug details as a separate **History** tab:

```text
Automation | BLE | Device | History | Script | Info
```

`History` is a product concept. `KVS` is an implementation detail and should not appear as the primary UI name.

This branch must remain separate from the active `work/ux-refinement-round3` branch. Before UI implementation starts, rebase this branch onto the accepted/merged UX baseline and re-run the architecture gate against the then-current Plug-detail structure.

## Product scope for v1

The first version is intentionally small:

- short-term rolling history stored on the Shelly;
- aggregate Climate temperature, humidity and VPD when available;
- relay state;
- compact automation reason/state code;
- fresh configured-sensor count when available;
- periodic samples plus important relay/safety transitions;
- read-only History UI in the phone;
- explicit logger install/enable/disable lifecycle;
- safe failure: logger failure must never change relay-control behavior.

Not v1:

- months of history on the Shelly;
- cloud synchronization;
- MQTT dependency;
- per-advertisement BLE logging;
- raw BLE packet archive;
- full per-sensor time series;
- user-defined arbitrary log schemas;
- background phone loop;
- coupling relay safety to successful KVS writes.

A later mobile-side long-term archive can ingest the Shelly ring and retain months of history without changing the on-device retention model.

## Preimplementation architecture gate

### Product owner

The physical Plug owns History as a user-facing capability. History is viewed from Plug details, not from a global dashboard and not from the BLE section.

### State owner

- Shelly KVS owns the durable short-term ring buffer.
- The datalogger runtime owns ring metadata and write sequencing.
- The Climate automation remains the owner of automation state and relay decisions.
- A future phone archive may own long-term copied history, but it must not become required for on-device logging.

### Side-effect owner

- the logger runtime owns periodic sampling and `KVS.Set` writes;
- `packages/shelly-client` owns KVS RPC reads/list/delete operations used by the phone;
- automation/install flows own logger script installation/removal and managed identity verification;
- screens/components never call raw Shelly RPC.

### UI owner

After the UX branch is merged, Plug details gains a `History` section. Product-specific history layout stays with the Plug detail feature/surface. Generic chart primitives may move to `@lcl/ui` only if they become genuinely reusable.

### Test owner

- codec/ring logic: pure package unit tests;
- KVS RPC client: `packages/shelly-client` request/response tests;
- logger generator/runtime text: `packages/script-generator` deterministic tests;
- mobile flow: focused feature tests;
- History UI: mobile tests + responsive Playwright;
- final behavior: real Shelly Plug S Gen3 hardware acceptance.

## Why KVS

Shelly KVS is a device-global persistent key-value store exposed directly through RPC. Current official limits are:

- key length: 42 characters;
- value length: 253 characters;
- maximum keys: 50;
- atomic compare/update support through per-item `etag`;
- global KVS revision incremented on every update;
- `KVS.GetMany` supports matching and pagination on current firmware.

Official documentation:

- https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS/

KVS is preferable to `Script.storage` for the history payload because the phone can read the store directly through normal Shelly RPC without evaluating code inside the logger script. `Script.storage` remains useful for small script-private configuration, but it is limited to 12 items and is cleared when that script is deleted.

Official `Script.storage` documentation:

- https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/Shelly/

## Flash-wear constraint

KVS must not be treated as a high-frequency telemetry database.

Shelly's own `ble/events-to-kvs.shelly.js` example explicitly warns that KVS is stored in flash memory and can degrade with frequent writes. That example defaults to a 60-minute write hold-off for measurements.

Reference:

- https://github.com/ALLTERCO/shelly-script-examples/blob/main/ble/events-to-kvs.shelly.js

Important: this official example is useful research material, not a production component for us. Shelly's current changelog says it was removed from the production examples manifest because it lacks production status. We should independently implement and test our logger rather than vendoring it.

The logger therefore buffers samples in RAM and writes batches. A reasonable v1 policy is:

```text
sample interval          15 min
normal flush interval    60 min
flush when segment full  yes
relay/safety transition  flush early when useful
minimum write spacing     protect against bursts
```

These values are defaults for the first hardware spike, not yet frozen product settings.

## Do not add the logger directly to climate-engine-v1

The current generated Climate runtime already has a project limit of 8000 bytes and the accepted four-sensor runtime is close to that ceiling. Adding a complete KVS ring implementation to `climate-engine-v1` would increase code size, heap pressure and safety-runtime complexity.

The logger must therefore be a **separate managed Shelly script**.

This is also a better safety boundary:

```text
Climate runtime failure -> existing safe-OFF rules apply
Logger failure          -> history stops, Climate keeps running unchanged
KVS failure             -> history write fails, relay behavior is untouched
```

Shelly currently allows up to three scripts running at once, but all scripts share the JS memory pool. The second-script design therefore requires a real-device memory/CPU acceptance check.

Official Script documentation:

- https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script/

## Proposed runtime relationship

Preferred v1 design:

```text
BLE sensors
    |
    v
climate-engine-v1
    |
    | existing diag() state
    v
Local Climate Link Datalogger
    |
    | batched KVS.Set
    v
Shelly KVS rolling ring
    |
    | KVS.List / KVS.GetMany
    v
phone History flow
```

The logger should not perform its own BLE scan. It should reuse the already interpreted Climate state so there is one owner of sensor parsing and automation semantics.

### Preferred source read: Script.Eval

The existing Climate runtime exposes `diag()` inside the running script. The logger can periodically request that state with local RPC:

```text
Script.Eval { id: <managed climate script id>, code: "diag()" }
```

Official Shelly documentation confirms that `Script.Eval` evaluates code inside a specified running script and returns the result.

This path has several advantages:

- no second BLE scanner;
- no duplicate sensor parser;
- no change to Climate relay logic;
- no additional HTTP endpoint required;
- source script identity is explicit.

This exact script-to-script call must be verified on the real Plug before implementation is committed as the final transport.

### Fallback source read

The current Climate runtime already exposes a `diag` HTTP endpoint. If script-to-script `Script.Eval` is not reliable enough, a separate script can be tested against the existing endpoint:

```text
/script/<climate-script-id>/diag
```

Shelly documents script HTTP endpoints at:

- https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/HTTPServer/

Do not modify Climate to emit duplicate telemetry unless both existing read paths prove unsuitable.

## Managed logger identity

Proposed script name:

```text
Local Climate Link Datalogger
```

The logger must be managed with the same conservative identity rules used elsewhere in Local Climate Link. Name alone is not enough evidence for destructive cleanup.

The generated logger should contain a compact managed header, for example:

```text
// LCL
// m: datalogger-v1
// g: <generator-version>
```

The phone should verify the managed marker before replace/delete operations.

The logger must know the managed Climate script ID it reads. Initial v1 can generate that source ID into logger configuration at install time. If the Climate script ID changes, the automation lifecycle must update/reinstall the logger deliberately; passive recovery must not silently mutate an otherwise valid runtime.

## KVS namespace

Reserve a narrow versioned namespace owned only by this feature:

```text
lcl.dl1.m
lcl.dl1.00
lcl.dl1.01
...
lcl.dl1.31
```

Initial allocation:

- 1 metadata key;
- 32 ring segment keys;
- total: 33 KVS keys;
- 17 of the global 50 keys remain available for unrelated Shelly/user data and future Local Climate Link needs.

Do not use all 50 keys.

The namespace may change before implementation if hardware probing shows another Local Climate Link KVS owner already exists.

## Ring model

The ring uses fixed slots. A segment is overwritten only when its turn returns.

Metadata logically contains:

```text
schema version
last committed slot
last committed sequence
time of last committed sample
```

Every segment also contains its own monotonically increasing sequence/generation. The phone reconstructs chronological order from sequence numbers, not lexical key order.

### Commit order

For each flush:

1. encode the new segment completely in RAM;
2. write the next data slot with `KVS.Set`;
3. only after successful slot write, update metadata;
4. on failure, keep Climate untouched and record logger-local error state.

If power is lost after step 2 and before step 3, the next boot can inspect the metadata slot and the adjacent ring slot and recover a single uncommitted newer generation. This avoids a full 32-key scan in the logger on every boot.

The mobile reader should still treat the segment generation as authoritative and tolerate stale metadata.

## Segment encoding

Do not store verbose JSON objects per sample. The 253-character value limit is too small.

Use a versioned compact string with fixed-point numbers. Candidate logical record fields:

```text
delta time from segment base
temperature C * 10
humidity % * 10
VPD kPa * 100
fresh sensor count
flags bitfield
reason code
```

Example logical sample before final codec design:

```text
15,213,624,108,1,1,3
```

Meaning could be:

```text
+15 min
21.3 C
62.4 % RH
1.08 kPa
1 fresh sensor
relay ON flag
reason code 3
```

Null/unavailable measurements need a compact sentinel.

The exact wire format must be finalized by a pure codec test that proves:

- deterministic encode/decode;
- values fit expected ranges;
- malformed segments are rejected, not partially trusted;
- a full segment remains below 253 characters;
- unknown future schema versions fail cleanly;
- useful sample density is measured rather than guessed.

Target for the first prototype: around 8-10 aggregate samples per segment. With 32 slots and 15-minute sampling, this should provide roughly 64-80 hours of periodic samples before event overhead. Actual retention must be calculated from the final codec and verified with worst-case values.

## Sampling policy

Periodic sampling is independent from BLE advertisement frequency.

Recommended v1 events:

### Periodic sample

Every 15 minutes when a valid source snapshot is available.

### Relay transition

Record a sample when the actual/managed relay state changes. This makes the graph useful even between periodic samples.

### Important automation state transition

Record meaningful safety/control reasons such as stale sensor, max-on cutoff or runtime error without logging every repeated identical reason.

### Deduplication

Do not append repeated event records if the relevant values/state are unchanged inside a short window.

## Time handling

History must not invent timestamps.

When Shelly exposes a valid Unix time, segment base time uses that wall clock.

If wall time is not synchronized after boot, the logger must not fabricate epoch time from uptime. For v1 either:

- defer durable samples until valid wall time exists; or
- introduce an explicit uptime-only record type that the UI labels as relative/unanchored.

The simpler first implementation is to defer normal durable samples until wall time is valid. Hardware testing should confirm real Plug behavior after reboot with LAN available but Internet/SNTP temporarily unavailable.

## Phone read path

Add typed KVS support to `packages/shelly-client`; do not issue raw RPC from the screen.

Expected package operations:

```text
listKvs(match)
getKvs(key)
getManyKvs(match, offset, limit)
deleteKvs(key, etag?)
```

Only expose the minimum API actually required by the implementation.

The History flow should:

1. verify physical Shelly identity before trusting device-scoped history;
2. list/read only `lcl.dl1.*`;
3. validate metadata and every segment at the boundary;
4. decode valid segments;
5. sort by generation/sequence;
6. discard overwritten/stale duplicates;
7. return typed history state to presentation.

`KVS.GetMany` responses can be paginated and historically had response-size limits. The reader must implement pagination rather than assume all 32 segments fit in one response.

## Mobile UI v1

After the UX branch has landed, add:

```text
Automation | BLE | Device | History | Script | Info
```

History v1 should be intentionally simple:

- time range covered by Shelly buffer;
- last sample time;
- temperature line;
- humidity line;
- VPD line when applicable;
- relay ON/OFF timeline/overlay;
- event/reason markers;
- empty state when logger is not installed or no samples exist;
- clear error state when logger/KVS is unavailable.

Do not show raw KVS keys or encoded records in the normal UI. Those belong in diagnostics if needed.

No new chart dependency should be added without explicit approval. First inspect whether the current stack can render the required graph acceptably with existing dependencies or a small project-owned SVG component.

## Install/uninstall semantics

Logger lifecycle is independent from the physical Plug entry but associated with the installed Climate automation in v1.

Proposed rules:

- saving/forgetting a Plug does not implicitly erase KVS history;
- installing History creates/verifies the managed logger script and initializes its namespace;
- disabling History may stop the logger while preserving stored data;
- uninstalling the logger is a separate deliberate operation;
- clearing history stops/coordinates the logger before deleting `lcl.dl1.*` keys;
- deleting/uninstalling Climate must explicitly decide what happens to its logger; no orphan mutation through an unrelated screen;
- all destructive logger operations verify physical device identity and managed logger identity first.

The exact product wording for preserve-vs-delete history during Climate uninstall needs user confirmation before implementation.

## Failure isolation

The following are hard requirements:

```text
KVS.Set fails         -> Climate runtime unchanged
logger script crashes -> Climate runtime unchanged
history decode fails  -> UI reports history problem; no device mutation
history read times out-> existing automation remains usable
logger source missing -> logger stops sampling; no relay mutation
```

The logger must never call `Switch.Set`.

## RPC/resource discipline

Shelly scripts have strict resource limits, including no more than five in-flight RPC calls per script. The logger must serialize its operations:

```text
source read
  -> encode/buffer
  -> optional KVS.Set segment
  -> optional KVS.Set metadata
```

No parallel burst of KVS and Script RPC calls.

The logger should use one periodic timer. It does not need its own BLE subscription.

Hardware acceptance must record `Script.GetStatus` for both Climate and Datalogger:

- `mem_used`;
- `mem_peak`;
- shared `mem_free`;
- `cpu` where firmware exposes it;
- script errors.

## Existing Shelly examples/research

### Official: BLE events to KVS

`ALLTERCO/shelly-script-examples/ble/events-to-kvs.shelly.js`

Useful ideas:

- KVS persistence of BLE-derived measurements;
- timestamp stored alongside value;
- prefix matching with `KVS.GetMany`;
- explicit write hold-off to protect flash.

Not reusable as our architecture:

- it stores latest measurement-style values, not a versioned rolling history ring;
- it is no longer in Shelly's production examples manifest;
- it is not integrated with Local Climate Link identity/safety rules.

Repository license is Apache-2.0. Prefer reimplementation from public API behavior rather than copying code.

### Official: KVS API examples

Shelly's KVS documentation provides `KVS.Set`, `Get`, `GetMany`, `List` and `Delete` examples plus `etag` semantics.

### Community: small history in KVS

`LeivoSepp/Shelly-Status-Alerts-via-Scenes` stores the last three outage timestamps in KVS. It demonstrates the same general idea — a bounded piece of local history — but is not a generic datalogger or ring-buffer implementation.

Reference:

- https://github.com/LeivoSepp/Shelly-Status-Alerts-via-Scenes

No production-ready official Shelly ring-buffer datalogger matching this product model was found during this research pass.

## Implementation sequence

### Phase 0 — hardware feasibility spike

Before product code:

1. confirm current Plug firmware and free script resources;
2. create a temporary minimal second script;
3. from that script call `Script.Eval` against the running Climate script and obtain `diag()`;
4. verify repeated reads do not disturb BLE scanning/relay runtime;
5. test a namespaced temporary KVS write/read/delete;
6. measure logger script memory/CPU;
7. test reboot persistence;
8. test behavior with SNTP temporarily unavailable;
9. remove all temporary test keys/scripts and leave relay state explicitly known.

Do not mutate the current Climate configuration merely to exercise the logger.

### Phase 1 — pure storage/codec model

- define datalogger schema/version;
- implement segment codec;
- implement ring ordering/recovery helpers;
- capacity tests with worst-case values;
- corruption/truncation tests.

### Phase 2 — Shelly client KVS boundary

- typed KVS RPC models;
- `List/Get/GetMany/Delete` as required;
- validation and pagination tests;
- fake-client support.

### Phase 3 — generated logger runtime

- separate `datalogger-v1` generator;
- source `diag()` read;
- periodic sampling;
- RAM batching;
- serialized writes;
- two-step slot/meta commit;
- recovery after interrupted commit;
- no relay mutation API present in generated code.

### Phase 4 — lifecycle integration

- managed logger identity;
- install/start/stop/delete flows;
- source-script ID binding;
- cleanup semantics;
- recovery behavior.

### Phase 5 — mobile History tab

Only after `work/ux-refinement-round3` is merged and this branch is rebased:

- add History tab;
- history query/flow;
- graph/timeline;
- responsive validation at canonical viewports;
- no new dependency without approval.

### Phase 6 — real hardware acceptance

Required checks:

- logging continues with phone disconnected;
- Climate controls relay normally while logger runs;
- periodic data survives reboot;
- ring wraps without corrupting order;
- interrupted write recovery works;
- KVS full/foreign-key scenario fails safely;
- logger stop/crash does not affect relay;
- History reads while logger writes;
- final relay state explicitly known;
- final `pnpm check:full` after UI acceptance.

## Open decisions before implementation

1. Default periodic interval: 10, 15 or 30 minutes? Current recommendation: 15 min.
2. Preserve KVS history when Climate automation is uninstalled, or offer an explicit choice?
3. Should relay/safety transitions force an immediate flush or only join the next hourly batch?
4. Do we want aggregate-only history in v1 (recommended) or per-sensor history immediately?
5. What retention target matters more: ~3 days at 15 min or ~1 week at 30 min?
6. If clock is unsynchronized after reboot, should we skip samples or keep explicitly relative uptime records?

These decisions should be resolved from the hardware spike and desired UX before writing the production logger.
