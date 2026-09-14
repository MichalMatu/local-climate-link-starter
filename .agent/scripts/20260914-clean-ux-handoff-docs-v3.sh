#!/usr/bin/env bash
set -euo pipefail
git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/20260914-clean-ux-handoff-docs-v2.sh > /tmp/lcl-doc-clean-v2-base.sh
python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/lcl-doc-clean-v2-base.sh')
s=p.read_text()
needle="bash /tmp/lcl-doc-clean-v2-runtime.sh\n"
# v2 generates a runtime shell from v1. Patch that generated runtime before execution.
replacement=r'''python3 - <<'INNER'
from pathlib import Path
p=Path('/tmp/lcl-doc-clean-v2-runtime.sh')
s=p.read_text()
marker='# Format only documentation touched by this cleanup.\n'
extra=r'''cat > docs/compatibility/outputs.md <<'EOF'
# Output compatibility

## Supported MVP output

| Output | Status | Requirements |
| --- | --- | --- |
| Shelly Plug S Gen3 (`S3PL-00112EU`) | validated | Local RPC; `switch:0`; Scripts + BLE for climate rules; native Schedule support for time rules; Matter must not block the required Scripts path |

Real hardware evidence is summarized in `docs/testing/hardware-matrix.md`.

## Current behavior

A saved plug is a global device, independent from rules. Registration verifies the physical Shelly identity and stores the current local endpoint. Rules reference the plug by stable device id; they do not copy durable endpoint ownership into the rule.

Climate rules deploy one exact managed Shelly script and use its in-process `R.m` protocol for AUTO/MANUAL. Direct relay control is blocked whenever a rule or live managed/orphan resource owns the relay.

Time rules use native Shelly Schedule jobs and own only the exact job ids recorded by deployment.

Shelly-side BLE discovery does **not** stop/restart the climate script to preserve user mode. The exact prior mode is read first, the running climate process is put into MANUAL with verified OFF, a separate discovery script temporarily owns BLE scanning, then cleanup removes that script, restarts climate BLE scanning and restores the exact prior mode. Unknown mode or ambiguous ownership fails closed.

LAN discovery/registration and time-rule use must not require climate BLE/script capability.

## Deferred outputs

- Tasmota/NOUS devices: separate future compatibility work.
- ESP8266 output-only devices: future remote-output path if product demand justifies it.
- ESP32 gateway/LiteGraph integration: separate product path, not part of this MVP.
EOF

cat > docs/compatibility/sensors.md <<'EOF'
# Sensor compatibility

## Validated climate sensors

| Sensor | Runtime format | Status |
| --- | --- | --- |
| Xiaomi LYWSD03MMC with PVVX | unencrypted BTHome v2 | validated |
| TP357 | ThermoPro custom BLE advertisement | validated |

Both profiles passed the real Shelly runtime matrix with heating, cooling, humidifying and dehumidifying rules, with VPD assist off/on. See `docs/testing/hardware-matrix.md` for the support evidence.

## Xiaomi / PVVX requirements

Use PVVX/ATC firmware configured for unencrypted BTHome v2. The runtime parser supports the BTHome objects used by the product for temperature, humidity and battery/voltage telemetry. Encrypted BTHome is not supported by the MVP.

Phone BLE is a foreground discovery/setup surface. Do not assume an iOS phone scan identifier is a stable runtime MAC. The durable sensor model stores the normalized runtime address required by the Shelly script.

The current product keeps the PVVX GATT time-setting path. It does not make the phone part of the long-running climate loop.

## TP357

The app parser and generated Shelly runtime use the same MatrixHub-derived manufacturer-data byte model for current temperature, humidity and battery values. TP357 is used from passive BLE advertisements; Local Climate Link does not maintain a separate local history database for it.

## Deferred sensor formats

- encrypted BTHome / encrypted Mijia: requires key management and dedicated validation;
- arbitrary Tuya BLE thermometers: not supported due to protocol/revision variability;
- Zigbee thermometers: separate coordinator/gateway product path.
EOF

cat > docs/parser-sources.md <<'EOF'
# Parser references and license notes

Keep parser implementations pure, bounds-checked and fixture-tested. Prefer official specifications; use third-party decoders for validation only unless their license is explicitly compatible. App-side and generated Shelly parser behavior must stay aligned for every supported profile.

## BTHome v2 / Xiaomi PVVX

Primary specification:

```text
https://bthome.io/format/
```

PVVX reference:

```text
https://github.com/pvvx/ATC_MiThermometer
```

The MVP supports unencrypted BTHome v2. Important currently supported objects include battery, temperature, humidity and voltage variants used by PVVX. The parser must safely reject truncated payloads, signed/endian mistakes and encrypted payloads, and safely skip unknown objects without reading past the buffer.

Some scan APIs expose normalized service data beginning at the BTHome device-info byte; raw advertisements may still include UUID bytes. Keep extraction/normalization distinct from payload parsing.

## TP357

Primary implementation source material:

```text
MichalMatu/MatrixHub TP357 parser model
https://decoder.theengs.io/devices/TP357.html
https://github.com/theengs/decoder/blob/development/src/devices/TPTH_json.h
```

Additional history/protocol references:

```text
https://github.com/pasky/tp357
https://pypi.org/project/tpy357/
https://github.com/Bluetooth-Devices/thermopro-ble
```

Theengs Decoder is GPL-3.0. Do not copy its decoder implementation into Local Climate Link without a deliberate licensing decision; use it as a behavioral/reference database. MatrixHub is project-owner source material explicitly approved for this repository.

Current TP357 implementation identifies the supported advertisement family and decodes current temperature, humidity and battery from the validated manufacturer-data layout. The same byte behavior exists in `ble-core` and the generated Shelly runtime. Real Shelly-side runtime validation has passed and is recorded in `docs/testing/hardware-matrix.md`.

## Parser change checklist

For every parser change record/test:

- input source (`serviceData`, `manufacturerData` or raw advertisement);
- byte order and signedness;
- scaling/unit;
- valid and malformed fixtures;
- unsupported/encrypted behavior;
- alignment between TypeScript and generated Shelly code;
- source/license implications.
EOF

pnpm exec prettier --write docs/compatibility/outputs.md docs/compatibility/sensors.md docs/parser-sources.md
! grep -R -nE 'pauses the main thermostat automation|status \| target|needs a dated Shelly \+ TP357 smoke|memo history is also setup-only' docs/compatibility docs/parser-sources.md

'''
if marker not in s:
    raise SystemExit('format marker not found')
s=s.replace(marker,extra+marker)
p.write_text(s)
INNER
bash /tmp/lcl-doc-clean-v2-runtime.sh
'''
if needle not in s:
    raise SystemExit('v2 execution marker not found')
s=s.replace(needle,replacement)
Path('/tmp/lcl-doc-clean-v3-runtime.sh').write_text(s)
PY
bash /tmp/lcl-doc-clean-v3-runtime.sh
