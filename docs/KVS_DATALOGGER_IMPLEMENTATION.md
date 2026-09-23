# KVS datalogger implementation

Status: dry implementation prepared; real Shelly acceptance still required  
Branch: `work/kvs-datalogger`  
Date: 2026-09-23

## Product rule

The datalogger is a **small passive add-on** to the existing Climate runtime.

It must not become a second automation engine.

Hard rules:

- Climate remains the only owner of BLE scanning and sensor parsing.
- Climate remains the only owner of relay decisions and safety behavior.
- Datalogger never calls `BLE.Scanner`.
- Datalogger never calls `Switch.Set`.
- Datalogger does not calculate Climate values that are not already exposed by `diag()`.
- Datalogger only reads the existing Climate diagnostics, compacts selected fields and periodically persists them to KVS.
- A datalogger failure must only mean loss of history; it must not affect automation.

## Runtime layout

```text
BLE sensors
    |
    v
Local Climate Link Thermostat
    |  existing diag()
    v
Local Climate Link Datalogger
    |
    | batched KVS.Set
    v
Shelly KVS rolling history
    |
    | KVS.GetMany
    v
phone History view
```

The datalogger is a separate managed Shelly script because the existing Climate script is already close to its project code-size ceiling and must remain safety-focused.

The current generated datalogger is roughly 2.3 KB with default configuration and has a hard generator limit of 4 KB.

## Data source

The logger reads the already-running Climate script using:

```text
Script.Eval { id: <climate-script-id>, code: "diag()" }
```

No second BLE scan is allowed.

Current Climate `diag()` already exposes everything required for v1.

Mapping used by the logger:

| History value | Existing `diag()` source |
| --- | --- |
| Unix timestamp | `y[1]` |
| uptime fallback | `y[2]` |
| temperature | `g[1]` |
| humidity | `g[2]` |
| VPD | `g[12]` |
| actual relay | `p[0]`, with `g[5]` fallback |
| automation reason | `g[6]` |

VPD is stored only when Climate already exposes it. The datalogger does not calculate a replacement value.

## Stored sample

Logical v1 sample:

```text
time
temperature
humidity
VPD
actual relay state
automation reason
```

No raw advertisements, RSSI history, per-sensor archive or duplicate automation state are stored in v1.

## Compact wire format

A segment is a compact JSON array, not verbose JSON objects.

Logical segment:

```text
[
  version,
  sequence,
  clock,
  baseTime,
  records
]
```

Logical record:

```text
[
  deltaSeconds,
  temperatureC_x10,
  humidityPct_x10,
  vpdKpa_x100,
  relay_0_or_1,
  reason
]
```

`null` is retained when a measurement is not available.

The pure codec in `@lcl/automation-core` validates ranges, clock consistency, monotonic time and the Shelly KVS 253-character value limit.

## KVS namespace

```text
lcl.dl1.m
lcl.dl1.00
lcl.dl1.01
...
lcl.dl1.31
```

Default allocation:

- 1 metadata key;
- 32 rotating data slots;
- 33 total KVS keys;
- 17 of Shelly's 50 KVS keys remain free.

The phone reconstructs chronological order from segment sequence numbers rather than lexical KVS key order.

## Default cadence

```text
sample interval       15 min
normal flush          2 h
ring slots            32
minimum flush         1 h
```

Sampling reads RAM/runtime state only. Flash writes are batched.

The generated runtime appends the sample first and then decides whether the current batch is due for flush, so the sample on the flush boundary is not lost.

## Flash wear

KVS is persistent flash storage and must not be used as high-frequency telemetry storage.

Shelly's official `ble/events-to-kvs.shelly.js` example explicitly warns about flash wear and defaults to a 60-minute write hold-off.

Reference:

- https://github.com/ALLTERCO/shelly-script-examples/blob/main/ble/events-to-kvs.shelly.js
- https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS/

Our default 2-hour batched flush is intentionally conservative.

## Installation safety

Managed logger name:

```text
Local Climate Link Datalogger
```

Managed marker:

```text
// LCL
// m: datalogger-v1
```

The existing generic script installer historically evaluates BLE scanner cleanup before stopping a running managed script. That behavior is appropriate for Climate/discovery scripts but must not be used for this logger.

The datalogger install plan therefore explicitly sets:

```text
cleanupBleScannerBeforeStop = false
```

Replacing/reinstalling the logger must stop only the logger script. It must not evaluate BLE cleanup and must not interrupt the Climate scanner.

Existing installer behavior remains unchanged for all other script types.

## Phone-side KVS client

`@lcl/shelly-client` now has typed operations for:

```text
KVS.Get
KVS.Set
KVS.Delete
KVS.List
KVS.GetMany
```

The client validates the 42-character key limit, KVS response boundaries, pagination progress and etag/revision responses.

`KVS.GetMany` parsing intentionally accepts both array-shaped and object-shaped `items`, because Shelly documentation/examples have exposed both forms across revisions.

## History UI

User-facing name: **History**.

It belongs in Plug details as a separate local section/tab. `KVS` must remain an implementation detail.

Initial UI should eventually show:

- temperature;
- humidity;
- VPD when present;
- actual relay timeline;
- automation reason/state events visible from sampled history;
- retained time range and last sample.

UI implementation is deliberately deferred until the backend passes real Shelly acceptance and the current Plug-detail UX baseline is stable.

## Already implemented without hardware

- compact v1 history model and codec;
- KVS ring decode/reconstruction;
- typed KVS RPC client;
- KVS pagination and response validation;
- separate datalogger script generator;
- 4 KB datalogger code-size guard;
- no-BLE/no-relay generator assertions;
- datalogger install plan;
- installer option that preserves the Climate BLE scanner during logger replacement;
- focused unit tests for codec, KVS client, generator and install behavior.

## Hardware gate

Nothing below may be declared supported until tested on the real Plug S Gen3:

1. Climate script remains running normally.
2. Datalogger installs as a second script.
3. `Script.Eval("diag()")` works reliably from the logger.
4. No second BLE scanner is started.
5. Installing/reinstalling the logger does not interrupt the Climate scanner.
6. Both scripts fit the shared Shelly JS memory budget with useful headroom.
7. Samples accumulate in RAM and flush to KVS.
8. KVS data survives reboot.
9. Ring rotation works after wrapping slot 31 to slot 00.
10. Climate relay behavior is unchanged if logger/KVS reads or writes fail.
11. Cleanup removes only Local Climate Link datalogger keys/script and leaves unrelated KVS entries untouched.

Until that gate passes, this branch is implementation-ready but not hardware-accepted.
