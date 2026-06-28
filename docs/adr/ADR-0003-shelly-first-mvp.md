# ADR-0003 — Shelly-first MVP before Tasmota/NOUS

## Status

Accepted

## Context

Earlier plans included Tasmota/NOUS and broader ESP32 paths. The current commercial MVP is a simpler bundle: Shelly Plug S Gen3 + one BLE thermometer + app.

Shelly is attractive because it is a consumer product with stock firmware, local RPC, scripts, BLE, and local relay control.

## Decision

MVP focuses on:

```text
Shelly Plug S Gen3
Xiaomi LYWSD03MMC / PVVX / BTHome v2
TP357 custom beacon
local Shelly Script
local relay switch:0
```

Tasmota/NOUS is deferred until the Shelly path works end-to-end.

## Consequences

Pros:

```text
No Shelly reflashing.
Simpler consumer support.
Narrower QA matrix.
Faster path to sellable bundle.
```

Tradeoffs:

```text
Matter can block scripting and must be detected.
Shelly Script limitations must be tested.
Support depends on Shelly firmware behavior.
```
