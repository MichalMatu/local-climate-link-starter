# Hardware test matrix

Keep this file updated after every real hardware test. Do not mark a device as supported without a dated test row.

## Supported / target hardware

| Device                             | Role              | MVP status     | Notes                                                              |
| ---------------------------------- | ----------------- | -------------- | ------------------------------------------------------------------ |
| Shelly Plug S Gen3                 | controller/output | test candidate | Stock firmware with Scripts and BLE required for local script path |
| Xiaomi LYWSD03MMC + PVVX BTHome v2 | sensor            | test candidate | Unencrypted BTHome v2 for MVP                                      |
| TP357                              | sensor            | test candidate | Parser implemented from MatrixHub model; Shelly-side smoke passed  |

## Software demo validation

| Test                         | Expected                              | Result | Date       | Notes                                       |
| ---------------------------- | ------------------------------------- | ------ | ---------- | ------------------------------------------- |
| Demo Xiaomi reading          | temperature/humidity/battery visible  | ✅     | 2026-06-28 | Covered by app flow and BTHome parser tests |
| Demo TP357 reading           | simulated reading visible             | ✅     | 2026-06-28 | Demo path remains available                 |
| TP357 parser fixture         | MatrixHub payload parses measurements | ✅     | 2026-06-29 | Covered by ble-core parser tests            |
| Demo Matter ON blocked state | install block copy visible            | ✅     | 2026-06-28 | Covered by component test                   |
| Generated script preview     | Switch.Set and failsafe visible       | ✅     | 2026-06-28 | Covered by app flow and generator tests     |
| Fake relay test              | final state OFF                       | ✅     | 2026-06-28 | Covered by Shelly client and app flow tests |

These rows are software validation only. Hardware readiness is based on the
dated real-device rows below.

## Automated functional matrix

The deterministic logic and script-generation matrix is covered by unit tests:

```text
packages/automation-core/src/__tests__/threshold-matrix.test.ts
  4 rule modes x VPD on/off
  ON, OFF, inside-band, stale, missing reading, missing control value,
  boot-safe-off, min-change guard, max-on guard, simulator transition,
  effective VPD threshold resolution

packages/script-generator/src/__tests__/runtime-matrix.test.ts
  2 sensor profiles x 4 rule modes x VPD on/off
  runtime mode selection, profile-specific parser selection, VPD code gating,
  Shelly safety codes, diagnostics endpoint, placeholder checks,
  syntax checks, script byte budget
```

This is 100% functional matrix coverage for deterministic TypeScript logic and
generated script shape. It does not replace manual hardware validation because
Shelly firmware, BLE reception, and real relay behavior cannot be fully proven
inside Vitest.

## Hardware smoke helper

Run repeatable Shelly install and observation tests with:

```bash
SHELLY_URL=http://<shelly-ip> SENSOR_MAC=<aa:bb:cc:dd:ee:ff> pnpm hardware:shelly:install
```

The helper installs the generated thermostat script, polls `/script/<id>/diag` when the
diagnostic endpoint is available, records RPC status snapshots, and sends a final relay
OFF command.

Run the full real hardware matrix with:

```bash
SHELLY_URL=http://<shelly-ip> \
XIAOMI_MAC=<xiaomi-runtime-mac> \
TP357_MAC=<tp357-runtime-mac> \
pnpm hardware:shelly:matrix
```

Use optional filters while isolating firmware or sensor issues:

```bash
SENSOR_FILTER=xiaomi|tp357|all
VPD_OPTIONS=off|on|both
```

The matrix runner tests:

```text
2 sensor profiles x 4 rule modes x VPD on/off
real Shelly firmware script upload/start
real Shelly-side BLE measurement for each runtime
real relay ON from the selected runtime rule
Script.Eval threshold update inside the same running runtime
real relay OFF from the selected runtime rule after the next BLE frame
final Script.Stop and final relay OFF
```

The helper scripts read the compact Local Climate Link diagnostic payload:

```text
{ v, z, s, q, y, p, g }
```

`z` is the generated config hash, `p` is plug telemetry, and `g` is a compact
runtime diagnostics array. User-facing labels are mapped in the app UI.

## Latest observed real hardware results

Current conclusion: deterministic script generation and real relay decisions
are validated, but the current Shelly Plug S Gen3 `1.7.5` hardware path is
blocked until Shelly-side BLE again sees the documented Xiaomi/PVVX BTHome v2
or TP357 advertisements. Do not generalize successful rows to other plugs,
firmware families, or random BLE sensors.

| Test                           | Expected                   | Result | Date       | Firmware       | Notes                                                                                                                                                                                                           |
| ------------------------------ | -------------------------- | ------ | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shelly manual IP check         | RPC responds               | ✅     | 2026-06-29 | unknown        | Shelly Plug S Gen3 reachable at `http://192.168.0.20/` during local network tests                                                                                                                               |
| Xiaomi Shelly-side BLE scan    | Shelly sees BTHome sensor  | ✅     | 2026-06-29 | unknown        | Temporary BLE discovery script saw `A4:C1:38:4F:24:CD` with RSSI around `-46 dBm`                                                                                                                               |
| BLE discovery cleanup safety   | relay OFF after scan/close | ✅     | 2026-06-29 | unknown        | Discovery flow stops the scanner script and keeps relay OFF; firmware still unrecorded                                                                                                                          |
| ON/OFF and AUTO/MANUAL         | final relay OFF            | ✅     | 2026-06-29 | unknown        | RPC test: MANUAL stopped script `1`; AUTO restarted it; final `Switch.Set` left OFF                                                                                                                             |
| TP357 Shelly-side BLE scan     | Shelly sees TP357 sensor   | ✅     | 2026-06-29 | 1.2.3          | `F7:5F:8D:0F:76:20`, about `30.2°C`, `54%`, `32%`, RSSI around `-72 dBm`; relay OFF                                                                                                                             |
| TP357 minimal runtime          | script stays running       | ✅     | 2026-06-29 | 1.2.3          | `tp357-minimal`, 3603 bytes, `mem_peak` 3598, `/diag` 200, relay OFF                                                                                                                                            |
| Full real runtime matrix       | 16/16 combinations pass    | ✅     | 2026-06-29 | 1.2.3-matter22 | Xiaomi + TP357, heating/cooling/humidifying/dehumidifying, VPD off/on; each case saw real BLE, relay ON, relay OFF; final script stopped and relay OFF                                                          |
| Full real runtime matrix       | 16/16 combinations pass    | ✅     | 2026-06-30 | 1.2.3-matter22 | Xiaomi + TP357, compact `/diag`, heating/cooling/humidifying/dehumidifying, VPD off/on; final script stopped and relay OFF                                                                                      |
| Read-only Shelly clock diag    | `/diag` includes time      | ✅     | 2026-06-30 | 1.2.3-matter22 | Smoke install returned `y.t`, `y.u`, `y.p` from `sys`; final relay OFF                                                                                                                                          |
| Throttled script install       | script install still works | ✅     | 2026-06-30 | 1.2.3-matter22 | Smoke install with throttled `Script.*` RPC returned `/diag`, saw Xiaomi BLE, and final relay OFF                                                                                                               |
| Current MVP hardware audit     | full flow pass             | ✅     | 2026-06-30 | 1.2.3-matter22 | Status, Shelly-side BLE scan, runtime upload, safe relay test, `/diag`, RPC reboot, boot OFF, script auto-start, BLE retry after boot, final relay OFF                                                          |
| Real BLE runtime matrix        | stable BLE for every case  | ⚠️     | 2026-06-30 | 1.7.5          | Runner updated for compact `/diag`; blocked by unstable sensor advertisements: Xiaomi appeared only in raw scan at about `-96 dBm`, TP357 was not seen; final script stopped and relay OFF                      |
| Generated runtime relay matrix | 16/16 combinations pass    | ✅     | 2026-06-30 | 1.7.5          | Synthetic `Script.Eval` measurements on real Shelly; Xiaomi + TP357, heating/cooling/humidifying/dehumidifying, VPD off/on; every generated runtime installed, drove relay ON, drove relay OFF, final relay OFF |
| Xiaomi real BLE runtime        | heating VPD off works      | ✅     | 2026-06-30 | 1.7.5          | After scanner cleanup and delayed runtime scan start, Xiaomi non-VPD heating saw real BTHome data, drove relay ON, accepted threshold update, drove relay OFF, final relay OFF                                  |
| Xiaomi real BLE VPD runtime    | receives BLE measurement   | ❌     | 2026-06-30 | 1.7.5          | Standalone first-after-reboot VPD runtime installed and stayed safe OFF, but `/diag` never received a BLE measurement; synthetic VPD relay logic still passed                                                   |
| TP357 real BLE runtime         | VPD off matrix starts      | ❌     | 2026-06-30 | 1.7.5          | `SENSOR_FILTER=tp357 VPD_OPTIONS=off`; first runtime was 3637 bytes but `/diag` stayed empty with reason `st`; final script stopped and relay OFF                                                               |
| Raw BLE target probe           | Shelly sees both sensors   | ❌     | 2026-06-30 | 1.7.5          | After sensors were moved within about 2 m, minimal raw probe received 67 BLE advertisements in 60 s, but none matched TP357 MAC/payload, Xiaomi MAC, BTHome `d2fc`, or TP357 manufacturer `c23d`; relay OFF     |

## Current MVP hardware audit — 2026-06-30

Shelly:

```text
URL: http://192.168.0.20/
model: S3PL-00112EU
firmware: 1.2.3-matter22
fw_id: 20240820-134301/1.2.3-plugsg3prod0-gec79607
script id: 1
runtime bytes: 3967 for Xiaomi/Pokoj smoke config
```

Checked sequence:

| Step             | Result | Notes                                                                |
| ---------------- | ------ | -------------------------------------------------------------------- |
| Status           | ✅     | `Shelly.GetStatus`, `Script.List`, and `Switch.GetStatus` responded  |
| BLE scan         | ✅     | Temporary discovery saw Xiaomi `A4:C1:38:4F:24:CD` and TP357 sensor  |
| Upload runtime   | ✅     | Script started with `mem_used` about `2814`, `mem_free` about `4186` |
| Diagnostics      | ✅     | `/script/1/diag` returned hash, time, plug telemetry, BLE reading    |
| Safe relay test  | ✅     | ON command sent, OFF command sent, final relay OFF                   |
| Reboot           | ✅     | `Shelly.Reboot`; script auto-started on boot, relay stayed OFF       |
| BLE after reboot | ✅     | Runtime recovered scan after boot and reported Xiaomi measurement    |
| Final safety     | ✅     | Final `Switch.GetStatus` reported `output: false`                    |

Important finding from the audit:

```text
The first extended diagnostics runtime was 4292 bytes and failed with out_of_memory.
The runtime was reduced below the 4 KB smoke budget and BLE start retry was added.
After reboot, the script auto-started, relay stayed OFF, and `/diag` reported
about 30.46°C, 56.81%, 100% battery, RSSI around -46 dBm.
```

## Latest full matrix summary

Date: 2026-06-30

Shelly:

```text
URL: http://192.168.0.20/
model: S3PL-00112EU
app: PlugSG3
firmware: 1.2.3-matter22
fw_id: 20240820-134301/1.2.3-plugsg3prod0-gec79607
script id: 1
final relay: OFF
final script: stopped
```

Sensors:

```text
Xiaomi/PVVX runtime MAC: A4:C1:38:4F:24:CD
Xiaomi observed range: about 29.55-29.58°C, 56.4-56.7%, 100%, RSSI -31 to -46 dBm

TP357 runtime MAC: F7:5F:8D:0F:76:20
TP357 observed range: about 28.9-29.0°C, 57%, 34%, RSSI -31 to -45 dBm
```

Passed combinations:

```text
xiaomi_lywsd03mmc_bthome_v2: heating VPD off/on
xiaomi_lywsd03mmc_bthome_v2: cooling VPD off/on
xiaomi_lywsd03mmc_bthome_v2: humidifying VPD off/on
xiaomi_lywsd03mmc_bthome_v2: dehumidifying VPD off/on
tp357_custom_v1: heating VPD off/on
tp357_custom_v1: cooling VPD off/on
tp357_custom_v1: humidifying VPD off/on
tp357_custom_v1: dehumidifying VPD off/on
```

Important firmware finding:

```text
Shelly Plug S Gen3 firmware 1.2.3-matter22 did not expose global BTHome in Script.Eval.
The Xiaomi runtime therefore uses a compact local BTHome v2 parser over advData.
The hardware helper parses compact `/diag` fields from `{ v, z, s, q, y, p, g }`.
```

## Manual test checklist — Shelly + Xiaomi BTHome

| Test                             | Expected                            | Result | Date | Firmware | Notes |
| -------------------------------- | ----------------------------------- | ------ | ---- | -------- | ----- |
| Shelly reachable by manual IP    | RPC responds                        | ☐      |      |          |       |
| Shelly.GetDeviceInfo model check | Plug S Gen3 or compatible           | ☐      |      |          |       |
| Matter ON detection              | Install blocked                     | ☐      |      |          |       |
| Matter OFF + Scripts available   | Install allowed                     | ☐      |      |          |       |
| Missing Script.List/BLE status   | Install blocked with clear message  | ☐      |      |          |       |
| Bluetooth enabled                | BLE scan can start                  | ☐      |      |          |       |
| Xiaomi phone scan                | temp/humidity visible               | ☐      |      |          |       |
| Xiaomi Shelly-side scan          | Shelly sees sensor                  | ☐      |      |          |       |
| Shelly-side scan tab switch      | scanner deleted, automation resumes | ☐      |      |          |       |
| Shelly-side scan app background  | scanner deleted, automation resumes | ☐      |      |          |       |
| Script upload                    | Script.PutCode succeeds             | ☐      |      |          |       |
| Script start                     | Script.GetStatus running            | ☐      |      |          |       |
| Install completion gate          | Gotowe shown only after relay test  | ☐      |      |          |       |
| Safe relay test                  | ON briefly, final OFF               | ☐      |      |          |       |
| Delete while relay ON            | OFF confirmed before stop/delete    | ☐      |      |          |       |
| Delete with Script.Stop failure  | OFF still attempted before delete   | ☐      |      |          |       |
| Threshold ON                     | relay ON below threshold            | ☐      |      |          |       |
| Threshold OFF                    | relay OFF above threshold           | ☐      |      |          |       |
| Stale timeout                    | relay OFF after timeout             | ☐      |      |          |       |
| Power cycle                      | boots safe OFF and script restarts  | ☐      |      |          |       |
| Diagnostics VPD/progi            | VPD and effective thresholds real   | ☐      |      |          |       |
| Diagnostics export               | no secrets/raw payload by default   | ☐      |      |          |       |

## Manual test checklist — TP357

| Test                      | Expected                                  | Result | Date       | Firmware/app                              | Notes                                          |
| ------------------------- | ----------------------------------------- | ------ | ---------- | ----------------------------------------- | ---------------------------------------------- |
| Capture raw advertisement | manufacturer/service data saved           | ☐      |            |                                           |                                                |
| App parser fixture        | temp/humidity/battery match known reading | ✅     | 2026-06-29 | MatrixHub model fixture in ble-core tests |
| Shelly generated parser   | same output as app parser                 | ✅     | 2026-06-29 | Generator includes MatrixHub byte offsets |
| Shelly-side scan          | Shelly sees TP357 at target distance      | ✅     | 2026-06-29 | Shelly Plug S Gen3 firmware 1.2.3         | MAC `F7:5F:8D:0F:76:20`, RSSI around `-72 dBm` |
| Minimal runtime install   | script runs and `/diag` responds          | ✅     | 2026-06-29 | Shelly Plug S Gen3 firmware 1.2.3         | `30.8°C`, `53%`, `mem_used` 2240 after 15 s    |
| Threshold ON/OFF          | relay follows heating rule                | ☐      |            |                                           |                                                |
| Stale timeout             | relay OFF after timeout                   | ☐      |            |                                           |                                                |

## Firmware matrix

| Device             | Firmware version | Tested date | Result | Notes                                                                                                                                                  |
| ------------------ | ---------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shelly Plug S Gen3 | 1.2.3-matter22   | 2026-06-29  | ✅     | BLE discovery and scripts work; Matter flag present                                                                                                    |
| Shelly Plug S Gen3 | 1.7.5            | 2026-06-30  | ⚠️     | Matter OFF, MQTT OFF, scripts work; generated runtime relay matrix passed 16/16, but real BLE matrix was blocked by weak/missing sensor advertisements |
| Xiaomi PVVX        |                  |             | ☐      | Record BTHome v2, encrypted off, advertising interval                                                                                                  |
| TP357              | stock            |             | ☐      | Record raw payload sample ID                                                                                                                           |

## Support rule

A device can be marketed as supported only when:

```text
[ ] real hardware test passed
[ ] firmware version recorded
[ ] compatibility doc updated
[ ] parser fixtures committed
[ ] troubleshooting entry added
[ ] safe relay/stale/power-cycle tests passed
```
