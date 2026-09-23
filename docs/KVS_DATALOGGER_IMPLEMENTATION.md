# KVS rolling history tail — parked implementation and re-audit

Status: **PARKED / DO NOT MERGE YET**  
Branch: `work/kvs-datalogger`  
Date: 2026-09-23  
Hardware acceptance: **not run**  
Repository final check after the latest simplification: **not run**

This document is the restart point when work on history is resumed.

At parking time `main` had already advanced beyond this branch. The branch is intentionally
left un-rebased so unrelated work can continue. A fresh compare/rebase/port is mandatory
when this feature resumes.

## 1. Final product decision

The original datalogger design was intentionally simplified.

This feature is **not a durable time-series database**. It is a small rolling tail that
answers a much narrower product question:

> What was happening recently, and were temperature/humidity roughly where expected?

The tail is expendable diagnostic history. Climate automation remains the product-critical
runtime.

Hard rule:

```text
if history fails -> history is lost
Climate behavior -> unchanged
```

## 2. Architecture

```text
BLE sensors
    |
    v
Local Climate Link Thermostat
    | existing diag()
    v
small History Tail script
    | compact batched KVS.Set
    v
Shelly KVS rolling tail
    |
    v
phone History view later
```

Ownership stays intentionally simple:

- Climate owns BLE scanning;
- Climate owns sensor parsing;
- Climate owns aggregation;
- Climate owns relay decisions and all safety behavior;
- History Tail only reads `diag()`;
- History Tail never calls `BLE.Scanner`;
- History Tail never calls `Switch.Set`;
- KVS is only short-term rolling storage;
- the phone may derive richer presentation later.

This keeps the critical Climate runtime small and avoids a second BLE scanner competing for
Shelly resources.

## 3. What is persisted

Only three values are persisted per accepted point:

```text
[temperature_x10, humidity_x10, relay_0_or_1]
```

Example:

```text
[234,551,0]
```

means:

```text
23.4 C
55.1 % RH
relay OFF
```

A stale/unusable Climate measurement is represented as:

```text
[null,null,relay]
```

This is important: Climate may keep its last numeric values in RAM after a sensor becomes
stale. The tail checks existing freshness information from `diag()` and writes a gap instead
of pretending that old values are fresh.

Pathological/non-finite/out-of-range values are also normalized to `null` instead of being
persisted. Current accepted storage ranges are:

```text
temperature -100..200 C
humidity       0..100 % RH
```

The relay bit is retained even when a measurement becomes null. One bad measurement must
not poison a whole 253-character segment and make the phone reject otherwise useful points.

## 4. What is deliberately NOT persisted

There is no persisted:

- wall-clock timestamp;
- date;
- uptime;
- per-record sequence number;
- VPD;
- automation reason string;
- in-range/out-of-range flag;
- threshold configuration snapshot;
- per-sensor history;
- RSSI history;
- battery history.

This is intentional.

The phone can later calculate VPD from temperature + humidity. It can also compare the raw
points with a chosen Climate configuration and render below/in-range/above bands.

Important limitation: because threshold/config snapshots are not stored, after the user
changes Climate thresholds there is no authoritative record of which historical threshold
was active for an older point. V1 history is therefore a recent trend/debug view, not an
audit log.

## 5. No time axis by design

Record order is meaningful; exact time is not.

The UI should initially use an ordinal X axis:

```text
older --------------------------------> newer
```

Do not label points with invented clock times.

Because event/change filtering is used, distance between adjacent points is not guaranteed
to represent an equal duration.

If exact time/duration becomes a real product requirement later, add it as a new format
version rather than complicating `tail-v1` now.

## 6. Noise/change filtering

The script polls existing Climate diagnostics every 5 minutes by default.

A new point is accepted when any of these is true:

```text
first point
relay changed
abs(temperature - last_saved_temperature) >= 0.3 C
abs(humidity - last_saved_humidity) >= 1.0 % RH
fresh <-> stale/null state changed
2 hours passed since the last accepted point
```

The final condition is a low-rate heartbeat. A stable environment therefore still leaves a
trace, while ordinary BLE/sensor noise does not consume the tail.

These thresholds are storage noise thresholds only. They are **not Climate control
hysteresis** and must never influence relay behavior.

The 5-minute polling interval is another intentional simplification: a very short excursion
or relay pulse that starts and ends entirely between polls can be absent from `tail-v1`.
If exact transition capture later becomes important, solve that as a new requirement rather
than turning the tail into another automation/event engine.

## 7. KVS format

Namespace:

```text
lcl.tail.m
lcl.tail.00
lcl.tail.01
...
lcl.tail.15
```

Default allocation:

```text
16 data slots
1 metadata key
17 KVS keys total
```

Maximum currently allowed by the generator is 32 data slots, but 16 is the conservative
default so the History feature does not consume most of Shelly's KVS namespace.

### Segment

A segment is:

```text
[1, [record, record, ...]]
```

Example:

```text
[1,[[234,551,0],[237,560,0],[239,568,1]]]
```

Segments are limited to Shelly's 253-character KVS value limit.

### Metadata

Metadata is only:

```text
[version, slot_count, next_slot, valid_slot_count]
```

Example:

```text
[1,16,7,16]
```

No generation, epoch or timestamp recovery machinery exists in `tail-v1`.

## 8. Ring ordering

The phone reconstructs the ring using only:

```text
nextSlot
validSlots
```

When the ring is full, oldest slot is:

```text
(nextSlot - validSlots + slots) mod slots
```

Then slots are read circularly until `nextSlot`.

If metadata is missing/corrupt, the pure decoder can still return individually valid slots
in lexical slot order, but that fallback must be treated as **unordered recovery data** by
future UI. It must not pretend to have an authoritative timeline.

## 9. Flash-write policy

Default runtime settings:

```text
poll              5 min
flush             2 h
slots             16
temperature delta 0.3 C
humidity delta    1.0 % RH
```

A flush normally performs two persistent KVS operations:

```text
1. write current data slot
2. write tiny metadata key
```

At a stable two-hour cadence this is approximately 12 normal flushes/day, therefore about
24 KVS writes/day. A highly variable environment may fill a 253-character segment and
flush earlier.

No flash-endurance number is claimed here. Real hardware acceptance must confirm behavior
and Shelly documentation must be rechecked before product release.

Shelly's official example explicitly warns that KVS is flash-backed and should not be used
for near-realtime logging:

- `ALLTERCO/shelly-script-examples/ble/events-to-kvs.shelly.js`
- Shelly Gen2+ KVS API documentation

The official example uses a 60-minute default write hold-off. Our normal two-hour flush is
intentionally conservative.

## 10. Expected retention

Retention is intentionally approximate because this is an event/change-filtered tail, not
a clocked database.

With the default 16 slots and two-hour normal flush, stable conditions preserve roughly the
last 32 hours of chunks.

Each chunk can contain many compact records, so active conditions preserve many more than
16 actual points. Typical three-field records are small enough for roughly tens of points
per 253-character value, depending on numeric width/nulls.

If the environment changes very frequently and a segment fills before two hours, the tail
covers less wall-clock time but retains more change points. This is desirable for a recent
activity view.

## 11. Power loss and restart — accepted lossy semantics

### Pending RAM batch

The current unflushed batch lives only in script RAM.

An abrupt reboot/power cut can lose up to roughly the configured flush window (default two
hours) of not-yet-flushed points.

This is an explicit product tradeoff to reduce flash writes.

### Slot written, metadata not written

The runtime writes the slot first, then metadata.

Power loss exactly between these operations can produce one of two harmless tail defects:

- newest slot is temporarily not referenced by metadata; or
- on a full wrapped ring, one slot can appear in the wrong relative order until a later
  successful flush repairs the head position.

This is acceptable for a lossy recent-history cache. Do not add a transactional journal
unless product requirements change.

### Reinstall/stop

The current generic script stop/reinstall path does not explicitly flush the RAM batch first.
Stopping/replacing the History script can therefore also lose the pending batch.

Accepted for the parked draft; decide whether to flush-before-stop during resumed work.

## 12. Stale sensor semantics

The tail does not trust `g[1]` / `g[2]` blindly.

Current Climate `diag()` exposes:

```text
g[0] = last accepted measurement uptime in ms
y[2] = current Shelly uptime in seconds
q[4] = configured stale timeout in seconds
```

The History runtime uses these existing fields only to decide whether the current aggregate
measurement is fresh.

If it is stale:

```text
temperature = null
humidity = null
relay = actual relay state
```

No time value is persisted.

This lets future UI distinguish "stable measurement" from "no valid recent measurement".

## 13. Actual relay state

The persisted relay bit should represent the physical/current Shelly relay, not only the
Climate runtime's requested state.

Current source preference:

```text
diag().p[0] actual Shelly switch output
fallback: diag().g[5]
```

This was intentionally chosen so History can show what the plug actually did.

## 14. Script size/resource policy

History is a second Shelly script because Climate is already close to the project's source
size ceiling in the worst multi-sensor configuration.

History generator hard limit:

```text
3000 bytes
```

The intended generated script is much smaller than Climate and contains no BLE parser,
scanner or automation logic.

However source byte size is **not** proof that both scripts fit the shared Shelly JS memory
budget. Real-device memory must still be measured.

Historical hardware evidence in `docs/testing/hardware-matrix.md` shows the 4-sensor Climate
runtime had about 17.2 KB script memory free on Plug S Gen3 firmware 1.7.5. Treat this only
as encouraging prior evidence, not acceptance of the additional History script.

## 15. Installer behavior

Managed internal script name currently remains:

```text
Local Climate Link Datalogger
```

Generated marker:

```text
// LCL
// m: tail-v1
```

History install sets:

```text
cleanupBleScannerBeforeStop = false
```

This is mandatory. Replacing History must never execute the generic BLE-scanner cleanup
against this script and must never interrupt Climate's scanner.

### BLOCKER before merge: ownership verification

The generic installer currently finds an existing script by name and can overwrite it.
For the History install plan `backupExisting` is currently false.

Before this feature is mergeable, replacing an existing same-name History script must verify
that its code is actually an LCL-managed History runtime (marker/mode/version) before
stopping or overwriting it.

Do not rely on the script name alone.

This is the highest-priority software fix when work resumes.

## 16. Source Climate contract

The small script intentionally reads the compact existing Climate `diag()` contract instead
of duplicating sensor logic.

Current fields used:

```text
g[0] last measurement uptime
g[1] aggregate temperature
g[2] aggregate humidity
g[5] runtime relay fallback
y[2] device uptime
q[4] stale timeout
p[0] actual relay output
```

### BLOCKER before merge: cross-runtime contract test

These compact array indexes are efficient but brittle.

When work resumes, add a test that generates a real current Climate script/`diag()` fixture
and proves History extraction against that exact contract. A future Climate refactor must
then break a test instead of silently changing History meaning.

Before using this parked branch after other work, rebase/port it onto fresh `main` and
revalidate every index above.

At parking time fresh `main` had advanced four commits beyond this branch's merge base. The
then-current `main` Climate generator was inspected and the `diag()` field layout above was
still unchanged. This is only a parking-time observation, not a future compatibility claim.

## 17. Climate script ID coupling

History is generated with one `sourceScriptId` and calls:

```text
Script.Eval({ id: sourceScriptId, code: "diag()" })
```

Normal Climate upgrades usually reuse the managed script slot, but if Climate is deleted and
recreated in a new slot the old History script will keep polling the old ID and report
`source-read` failures.

Resumed implementation needs one simple lifecycle rule:

```text
if managed Climate script ID changes -> regenerate/reinstall History with the new ID
```

Do not add runtime script discovery inside the tiny History script unless hardware evidence
shows it is necessary.

## 18. KVS capacity/failure behavior

Default History consumes at most 17 keys once the ring is full.

There is not yet an install-time free-key preflight.

If the device cannot allocate a new History KVS key, `KVS.Set` fails and History records an
internal error. Climate remains unaffected.

When work resumes, decide between:

1. keep this fail-soft behavior; or
2. preflight KVS usage from the phone and choose a smaller slot count.

Do not delete unrelated KVS entries to make room.

## 19. Phone-side KVS client

`@lcl/shelly-client` contains typed wrappers for:

```text
KVS.Get
KVS.Set
KVS.Delete
KVS.List
KVS.GetMany
```

The reader accepts both array-shaped and object-shaped `KVS.GetMany.items` because Shelly
documentation/examples have exposed both shapes across revisions.

The intended history read path later is:

```text
KVS.GetMany("lcl.tail.*")
-> decodeLclHistoryKvsItems(...)
-> ordinal recent-history model
-> History UI
```

No phone-side persistence/database has been implemented.

## 20. Future derived data

Keep these OUT of the Shelly persisted format unless a real requirement proves otherwise.

The phone can derive:

- VPD from temperature + humidity;
- below / within / above configured range;
- visual threshold bands;
- relay transition markers visible in retained points;
- simple excursion detection over retained points;
- display smoothing/hysteresis;
- min/max/average over the retained points.

Because sampling is change-filtered and only every five minutes, derived excursion/relay
analysis is approximate. It must not claim to reconstruct transitions that happened entirely
between retained observations.

This is why raw temperature/humidity/relay is the preferred persisted primitive.

## 21. Current code ownership

```text
packages/automation-core/src/history/kvsHistory.ts
    pure compact codec, ring ordering, change-threshold helper

packages/script-generator/src/shelly/datalogger.ts
    tiny Shelly tail runtime generator

packages/shelly-client/src/kvs.ts
    typed KVS RPC boundary

packages/shelly-client/src/scripts/dataloggerInstall.ts
    isolated History install plan

packages/shelly-client/src/scripts/installLifecycle.ts
    generic installer option allowing History replacement without BLE cleanup
```

This package placement passed the architecture re-audit conceptually:

- domain/codec has no device side effects;
- RPC stays in `shelly-client`;
- generated Shelly code stays in `script-generator`;
- mobile UI/storage has not leaked into packages.

No new package is justified.

## 22. Re-audit findings

### Good / keep

- separate tiny script instead of increasing Climate code size;
- exactly one BLE scanner, owned by Climate;
- zero History relay control;
- only existing `diag()` as source;
- raw minimal record format;
- no wall-clock dependency;
- noise/change filtering;
- explicit stale/invalid gaps;
- small default KVS footprint;
- lossy behavior isolated from automation safety;
- no UI work mixed into the backend draft.

### Must fix/test before merge

1. verify same-name existing script ownership before overwrite;
2. add Climate `diag()` <-> History extraction contract regression;
3. run package tests/typechecks and one final repository `pnpm check` after rebasing to fresh
   `main`;
4. test `Script.Eval("diag()")` between two simultaneous scripts on real Plug S Gen3;
5. measure memory with current real Climate configuration + History simultaneously;
6. verify History replacement does not interrupt Climate BLE scanning;
7. verify KVS writes/readback and ring wrap on hardware;
8. verify stale and invalid readings become `[null,null,relay]` on hardware;
9. verify KVS failure cannot change Climate relay behavior;
10. decide whether pending RAM should be flushed before intentional History stop/reinstall.

### Explicitly accepted limitations for v1

- no exact timestamps;
- no duration calculation;
- 5-minute polling can miss very short excursions or relay cycles;
- up to approximately one flush window of newest points may be lost on abrupt power loss;
- one slot/meta split-write can make the newest ring order temporarily imperfect;
- old points are not tied to historical Climate threshold revisions;
- History is not forensic/audit-grade storage.

## 23. Verification state at parking time

Do **not** describe this branch as tested/complete.

What was done:

- source re-audit;
- architecture re-audit;
- simplification of the codec/runtime/tests to `tail-v1`;
- official Shelly KVS/example review earlier in this work;
- static inspection against the branch Climate `diag()` layout;
- static re-check against the then-current fresh `main` Climate generator after `main`
  advanced four commits; the used `diag()` indexes were still unchanged.

What was NOT done after the final simplification:

- no local `pnpm` package test run;
- no `pnpm typecheck` run;
- no final `pnpm check`;
- no GitHub CI run was available for the branch;
- no physical Shelly run;
- no shared-memory measurement;
- no real KVS wrap/power-loss test.

The Local Agent executable task path was not forced/worked around when tool safety blocked
creating a command task. This is intentional; tests must be run normally when work resumes.

## 24. Resume checklist

When returning to this feature later, do this in order:

```text
1. fetch fresh main
2. read AGENTS.md + packages/AGENTS.md
3. read this document
4. compare/rebase/port work/kvs-datalogger onto fresh main
5. re-read current Climate diag() layout
6. add diag contract test
7. add managed-script ownership guard
8. run focused package tests/typechecks
9. run exactly one final pnpm check
10. only then use the real Shelly hardware
11. install History as second script
12. measure mem_used/mem_free for both scripts
13. observe BLE/Climate behavior unchanged
14. create several tail points and read KVS back
15. test stale/invalid gap
16. test ring wrap using temporarily small slot count
17. reboot and confirm acceptable lossy recovery
18. leave relay in an explicit known safe state
```

Only after these pass should the mobile **History** section/tab be implemented.

## 25. UI direction when resumed

User-facing name should be **History** / **Historia**, not KVS/Datalogger.

History belongs to concrete Plug details.

The simplest initial view should show:

- ordinal temperature trend;
- ordinal humidity trend;
- relay ON/OFF indication;
- gaps for stale/unavailable/invalid sensor data;
- optional VPD calculated on the phone;
- current-config range overlay calculated on the phone.

Do not promise exact timestamps or durations for `tail-v1`.

## 26. External references to recheck on resume

Shelly KVS:

- https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS/

Shelly script API / `Script.Eval`:

- https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script/

Official example warning about KVS flash writes:

- https://github.com/ALLTERCO/shelly-script-examples/blob/main/ble/events-to-kvs.shelly.js

Do not assume these docs/API details remain unchanged when this parked branch is resumed.
