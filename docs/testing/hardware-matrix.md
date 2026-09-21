# Hardware test matrix

Only dated real-device evidence establishes hardware support. Automated tests prove deterministic logic but do not replace Shelly firmware, BLE reception or relay validation.

## Current hardware

| Device                             | Role                 | Current evidence                                                                                                |
| ---------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------- |
| Shelly Plug S Gen3                 | controller/output    | real HTTP RPC, scripts, BLE, schedules, relay and Plug settings tested; firmware 1.7.5 in current stabilization |
| Samsung SM-S906B / S22+            | Android configurator | physical app install/navigation/network acceptance; Android 16 in current stabilization                         |
| Xiaomi LYWSD03MMC / PVVX BTHome v2 | climate sensor       | real Shelly-side BLE/runtime matrix passed                                                                      |
| TP357                              | climate sensor       | real Shelly-side BLE/runtime matrix passed                                                                      |

## Current acceptance evidence

| Date       | Test                                       | Result | Evidence / final state                                                                                                                                                                           |
| ---------- | ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-07-04 | Full real runtime matrix                   | PASS   | Xiaomi/PVVX + TP357; heating/cooling/humidifying/dehumidifying; VPD off/on; 16/16 cases saw real BLE, relay ON and relay OFF; final relay OFF                                                    |
| 2026-09-21 | Plug settings regression smoke             | PASS   | Real Plug S Gen3 settings paths retained, including LED, physical-button mode and Shelly Cloud work completed during the stabilization series                                                    |
| 2026-09-21 | Fresh-store remote recovery                | PASS   | S22+ app data cleared, physical Plug re-added, managed Climate automation reconstructed; AUTO/MANUAL and live values returned; remote runtime was not rewritten                                  |
| 2026-09-21 | Forget -> re-add lifecycle                 | PASS   | Forget removed only saved Plug state; durable automation stayed visible; scan/re-add produced exactly one Plug and recovered ownership                                                           |
| 2026-09-21 | Remote immutability during recovery/re-add | PASS   | script 1 `Local Climate Link Thermostat` remained byte-identical, SHA-256 `6b9aa123b72e85828ae4d930d3a7f24df4ce0e2abb55230ae409bcff23538215`; `Schedule.List` remained empty; relay remained OFF |
| 2026-09-21 | Identity mutation gates                    | PASS   | automated regressions + real lifecycle acceptance; endpoint identity is verified before runtime/destructive mutations                                                                            |
| 2026-09-21 | Stable engine hardware smoke               | PASS   | `climate-engine-v1` ran on a temporary Shelly slot; generated script 5713 B, `mem_peak` 4452, `mem_free` 21574; production script/schedules remained unchanged and relay finished OFF            |
| 2026-09-21 | Persistent config hardware smoke           | PASS   | config-only `Script.Eval` changed active thresholds/RSSI without changing script SHA; `Script.storage` value survived script restart and was loaded back into active config                      |
| 2026-09-21 | Persistent recovery on S22+                | PASS   | clean Android install, LAN scan and Add recovered the existing Climate automation; dashboard showed Humidity control, live humidity/temperature/VPD and working AUTO/MANUAL controls             |

Current stabilization Shelly identity: `shellyplugsg3-e4b063d7f530`, model `S3PL-00112EU`, firmware `1.7.5`. IP addresses are test transport locations and are not durable identity.

Persistent-config smoke generated a 6480 B runtime and observed roughly `mem_peak` 4.3 KB with about 21.3 KB script memory free on firmware 1.7.5. Continue measuring as new operators are added.

## Repeatable commands

Install a physical Android alpha build:

```bash
pnpm android:phone-alpha
```

Install/observe a generated Shelly climate runtime:

```bash
SHELLY_URL=http://<shelly-ip> SENSOR_MAC=<sensor-mac> pnpm hardware:shelly:install
```

Run the real runtime matrix:

```bash
SHELLY_URL=http://<shelly-ip> \
XIAOMI_MAC=<xiaomi-mac> \
TP357_MAC=<tp357-mac> \
pnpm hardware:shelly:matrix
```

Useful filters:

```bash
SENSOR_FILTER=xiaomi|tp357|all
VPD_OPTIONS=off|on|both
```

Run a longer soak when runtime stability matters:

```bash
SHELLY_URL=http://<shelly-ip> SCRIPT_ID=1 make shelly-soak-run
```

Use `SOAK_CYCLE_RELAY=1` only for supervised/endurance tests intended to exercise real rule-driven ON/OFF transitions. Hardware helpers must finish with an explicit safe final relay state.

## Acceptance rules

A hardware-facing slice is complete only when the relevant combination is verified on the real device and the final relay state is known. Recovery/reconciliation tests must also verify that valid remote scripts and schedules are not silently replaced.

When firmware, device model or BLE behavior changes materially, add a new dated row rather than rewriting old evidence.
