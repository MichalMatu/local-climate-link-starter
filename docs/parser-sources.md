# Parser sources and implementation notes

This file defines what can be used as parser reference material and what must not be copied without license review.

## 1. Parser policy

Rules:

```text
Use official specs first.
Use reference decoder databases for validation and fixtures.
Do not copy decoder code without license review.
Keep parser functions pure and fixture-tested.
Keep app parser and generated Shelly Script parser behavior aligned.
```

Every parser must document:

```text
input source: serviceData / manufacturerData / raw advertisement
byte order
signed/unsigned interpretation
unit scaling
supported fields
unsupported fields
sample payloads
source references
license notes
```

## 2. BTHome v2

Primary source:

```text
https://bthome.io/format/
```

Key facts to implement:

```text
service UUID: 0xfcd2
BTHome v2 payload starts with Device Information byte
device info bit 0: encryption flag
version bits: expect version 2
object id 0x01: battery, uint8, %
object id 0x02: temperature, sint16 little-endian, factor 0.01 °C
object id 0x03: humidity, uint16 little-endian, factor 0.01 %
object id 0x0c: voltage, uint16 little-endian, factor 0.001 V
object id 0x2e: humidity, uint8, factor 1 %
object id 0x45: temperature, sint16 little-endian, factor 0.1 °C
```

Implementation requirements:

```text
support unencrypted BTHome v2 first
return unsupported/encrypted for encrypted payloads in MVP
support both normalized serviceData payload and raw advertisement extraction if needed
ignore unknown object IDs safely, never read past payload length, and preserve already parsed known fields when safe
```

Important normalization pitfall:

Some APIs expose service data with UUID already removed, so payload starts at the device-info byte. Raw advertisement bytes may include the UUID bytes `d2 fc`. The parser must either accept only normalized payloads or have a clearly named normalizer:

```ts
extractBthomeV2Payload(input: Uint8Array): Result<Uint8Array>;
parseBthomeV2Payload(payload: Uint8Array): Result<ParsedSensorAdvertisement>;
```

Test fixtures required:

```text
BTHome unencrypted temp + humidity + battery
BTHome encrypted flag set -> unsupported/encrypted result
BTHome malformed short payload -> validation error
BTHome unknown object id -> safe skip/unsupported without crash
BTHome negative temperature
BTHome voltage object id 0x0c
```

## 3. Xiaomi LYWSD03MMC / PVVX

Primary source:

```text
https://github.com/pvvx/ATC_MiThermometer
https://pvvx.github.io/ATC_MiThermometer/TelinkMiFlasher.html
```

MVP assumption:

```text
The user/seller provides the Xiaomi sensor already flashed to PVVX/ATC and configured to unencrypted BTHome v2.
The app does not implement native PVVX OTA in the first implementation skeleton.
```

Later versions may support:

```text
ATC parser
PVVX custom parser
Mijia encrypted parser with bind key
native Telink OTA
firmware manifest with hashes
known hardware revision database
```

## 4. TP357

Primary reference database:

```text
MichalMatu/MatrixHub export/ble_scanner parser source
Theengs Decoder compatible devices and decoder definitions
https://decoder.theengs.io/devices/devices.html
https://decoder.theengs.io/devices/TP357.html
https://github.com/theengs/decoder/blob/development/src/devices/TPTH_json.h
```

License warning:

```text
Theengs Decoder is GPL-3.0. Do not copy its decoder code into the Local Climate Link runtime.
The project license is custom source-available noncommercial and is not GPL-compatible.
Use Theengs as reference and validation unless a separate written relicensing decision allows GPL-compatible reuse with notices.
MatrixHub is owned by the same project owner and was explicitly approved as source material for this repository.
```

History / logger references:

```text
https://github.com/pasky/tp357
https://pypi.org/project/tpy357/
https://github.com/Bluetooth-Devices/thermopro-ble
```

Findings:

```text
pasky/tp357 is MIT-licensed and documents GATT history modes:
  now, day, week, year
  day = minute-by-minute over the last 24 hours
  week/year = hour-level stored data

tpy357 documents a similar split:
  passive advertising scan for current values
  query_tp357(dev, mode) for day/week/year stored data

thermopro-ble and Theengs cover passive advertisement decoding only.
They are still useful to validate current-value parsing, not stored-history reads.
```

Implementation plan for TP357 stored history:

```text
1. Keep current TP357 card as live-advertisement only.
2. Add TP357 history behind a separate GATT reader after protocol review.
3. Start with "day" history only because it gives dense 24 h data and is enough for charts.
4. Do not copy code blindly. If we adapt MIT protocol details from pasky/tp357,
   preserve attribution in THIRD_PARTY_NOTICES and add fixture tests first.
5. Reuse the same phone BLE radio lock used by PVVX history so scan and GATT do not overlap.
6. If the TP357 GATT protocol differs between firmware revisions, keep history disabled
   and show only live values until real-device captures confirm the command set.
```

Current implementation decision:

```text
TP357 stored history is not enabled yet. Public references show that it is
possible, but the sample ordering/time base and Android GATT behavior still need
real-device validation. The mobile app therefore persists recent live TP357
samples for charts, while Xiaomi/PVVX can preload its supported memo history.
```

Implemented MatrixHub behavior:

```text
Device identity is detected from Local Name prefix `TP357`.
The parser reads manufacturer data that includes the two manufacturer-id bytes.
Temperature uses signed int16 little-endian from bytes 1..2, divided by 10.
Humidity is byte 3 as percent.
Battery is byte 4 as percent.
Payloads outside sane temperature/humidity ranges are rejected.
```

Reference behavior to validate against real captures:

```text
Device family includes TP350 / TP357 / TP358 / TP359 / TP393.
Theengs marks TP357 as BLE broadcast with temperature, humidity, and battery data, not encrypted.
The Theengs decoder checks ThermoPro manufacturer data and decodes temperature, humidity, and battery status.
```

Implementation status:

```text
1. MatrixHub parser model is ported to ble-core.
2. The same byte model is ported to generated Shelly Script.
3. Shelly BLE discovery reports TP357 candidates from advData name + manufacturer data.
4. Hardware matrix still needs a dated Shelly + TP357 smoke test before marketing support as complete.
```

Fixture schema:

```json
{
  "name": "tp357-sample-room-temp",
  "source": "user-captured",
  "advertisement": {
    "name": "TP357",
    "rssi": -60,
    "manufacturerDataHex": "...",
    "serviceData": {}
  },
  "expected": {
    "temperatureC": 21.4,
    "humidityPct": 48,
    "batteryPct": null
  },
  "notes": "Captured with Android app / Shelly log / nRF Connect"
}
```

## 5. Theengs Decoder as compatibility database

Use cases:

```text
find candidate device support
compare known devices and service/manufacturer data hints
validate parser behavior with sample payloads
prepare compatibility roadmap
```

Do not:

```text
copy GPL decoder code without license decision
silently vendor the library into app runtime
claim support for every Theengs-compatible device in MVP
```

## 6. Shelly script examples

Primary source:

```text
https://github.com/ALLTERCO/shelly-script-examples
```

Useful examples:

```text
BLE Thermometer passive data collector for MQTT Autodiscovery
BLE in Scripting - Ruuvi example
BTHome sensor webhook trigger
BLU presence watcher with auto-off
Shelly BLU Scanner
```

Use as architecture reference, not blind copy. Do not vendor the full upstream
example tree into this repository. If code is copied, preserve license/notice
and document exact origin in `legal/THIRD_PARTY_NOTICES.md`.

## 7. Shelly official APIs

Primary sources:

```text
https://shelly-api-docs.shelly.cloud/gen2/Scripts/APIs/BLE/
https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script/
https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch/
https://shelly-api-docs.shelly.cloud/gen2/DynamicComponents/BTHome/
```

Required implementation facts:

```text
BLE.Scanner.start returns null on failure
BTHome.parseData(data[, addr[, key]]) exists for BTHome payloads
BLE.Scanner.subscribe receives scan events; runtime scripts must ignore everything except BLE.Scanner.SCAN_RESULT
BTHome.parseData(data) returns array-style values with `name` and `val`; do not assume a `parsed.t` field
Script.PutCode requires target script to be non-running
large scripts may need chunked PutCode with append
Script.SetConfig must enable run-on-boot
Script.GetStatus exposes running/error/memory fields
Switch.Set controls relay output and supports tag/toggle_after
```

Hardware note: Shelly Plug S Gen3 firmware `1.2.3-matter22` did not expose a
global `BTHome` object in Shelly Script during local tests on June 29, 2026.
The generated Xiaomi runtime therefore uses a compact local BTHome v2 parser for
the supported object ids instead of depending on `BTHome.parseData`.

Hardware note: Shelly Plug S Gen3 firmware `1.7.5` exposes the scanner start
method as `BLE.Scanner.Start`, while earlier tested firmware accepted
`BLE.Scanner.start`. Generated runtimes and temporary discovery scripts must use
the available method instead of assuming one casing.

## 8. Parser acceptance checklist

For every parser:

```text
[ ] valid payload fixture
[ ] malformed payload fixture
[ ] too-short payload fixture
[ ] unknown field fixture where applicable
[ ] unit scaling test
[ ] signed negative temperature test where applicable
[ ] app parser test
[ ] generated Shelly Script parser test or snapshot
[ ] source and license documented
```
