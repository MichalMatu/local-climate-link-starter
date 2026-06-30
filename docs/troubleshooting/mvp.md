# MVP troubleshooting

## Matter enabled

User message:

```text
Matter jest włączony. Lokalny termostat wymaga Shelly Scripts. Wyłącz Matter w Shelly, aby kontynuować.
```

Action: block install. Do not attempt script upload.

Some Matter firmware reports Matter only in `Shelly.GetDeviceInfo`, not in
`Shelly.GetStatus`. The app must treat either source as blocking. If a previous
Local Climate Link script already exists and `Script.GetStatus` reports
`out_of_memory`, disable Matter, restart Shelly, and upload the rule again.

In demo mode, enable the Matter ON scenario explicitly. The compatible card and the blocked card must not be shown at the same time.

## Scripts or BLE missing in Shelly status

User messages:

```text
Nie widzę Shelly Scripts w statusie gniazdka. Sprawdź firmware albo wyłącz Matter.
Nie widzę Bluetooth/BLE w statusie Shelly. Sprawdź, czy gniazdko obsługuje BLE.
```

Action: block install only when script RPC is unavailable or BLE is missing/disabled.
Some Shelly firmware does not expose a global `script` component in
`Shelly.GetStatus`; if `Script.List` works, the app treats Shelly Scripts as
available. Recheck firmware, Shelly model, Matter state, and Bluetooth settings
before trying to upload the script.

## Invalid threshold

User message:

```text
Próg włączenia musi być niższy niż próg wyłączenia.
```

Action: block script preview and install until `rule.control` thresholds match the
selected direction.

For heating and humidifying, `onThreshold` must be lower than `offThreshold`.
For cooling and dehumidifying, `onThreshold` must be higher than `offThreshold`.

## No BLE sensor seen by phone

In the current skeleton, the default flow is demo mode. If no sensor appears in the web preview, first check the app state/test flow rather than hardware.

Check:

```text
Bluetooth permission
phone Bluetooth enabled
sensor battery
sensor within 1–2 m
BTHome v2 enabled for Xiaomi
TP357 fixture/parser status
Android permission mode, especially neverForLocation
```

## Phone sees sensor but Shelly does not

Check:

```text
Shelly Bluetooth enabled
Shelly BLE scanner can start
sensor closer to Shelly
RSSI threshold not too strict
runtimeAddress matches the address Shelly sees
Shelly-side discovery path working
Matter/Scripts availability
```

## Shelly-side BLE scan finds no sensor

The `Skanuj BLE` action runs from the selected Shelly, not from the phone. The app
opens a modal, uploads a temporary `Local Climate Link BLE Discovery` script,
sets the relay OFF, stops the main automation while scanning, and polls
`/script/<id>/ble-scan` automatically. Closing the modal stops the scanner and
restarts automation only if it was running before discovery. Switching away from
the Shelly tab or backgrounding/closing the app should trigger the same cleanup.
Both the temporary discovery script and generated runtime script request a
passive BLE scan close to Shelly's documented script defaults
(`interval_ms: 241`, `window_ms: 61`). Scan-level RSSI filtering is disabled
(`rssi_thr: 0`) so packets reach the script first; Local Climate Link applies
the configured RSSI threshold in JavaScript after receipt. These settings do not
change radio transmit power because sensor advertisements are received, not
sent, by the plug.

If Shelly reports `out_of_memory`, the discovery script could not stay running
within the plug's available script memory. Close the BLE scan modal, wait a few
seconds, and try again. If it repeats, restart Shelly and verify that the main
automation is stopped while the temporary scanner runs.

Upload chunking is not the same as runtime memory. `Script.PutCode` can upload a
large script in chunks, but Shelly can still fail later with `out_of_memory` or
`out_of_codespace` when the JavaScript engine starts or serves an endpoint. The
runtime script should be the minimal generated variant for one sensor profile:
`xiaomi-bthome-minimal` or `tp357-minimal`. The `Local Climate Link BLE Discovery`
script is temporary and should be stopped and deleted after the scan.

Useful checks:

```bash
curl -sS -X POST http://<shelly-ip>/rpc \
  -H 'Content-Type: application/json' \
  -d '{"id":1,"method":"Script.GetStatus","params":{"id":1}}'
```

Read `running`, `mem_used`, `mem_peak`, `mem_free`, and `errors`. A healthy final
runtime should not keep the discovery script running beside it.

Check:

```text
Shelly and thermometer are close enough
Bluetooth is enabled on Shelly
Scripts are enabled on Shelly
Matter is not blocking Scripts
Xiaomi/PVVX advertises unencrypted BTHome v2
RSSI is not too weak at Shelly location
the app is pointed at the saved Shelly plug you want to scan from
```

If the browser shows a 403 or network error during development, verify that Vite
is running and the Shelly request is going through the dev proxy. The proxy only
allows private/local targets and the MVP Shelly paths: `/rpc`,
`/script/<id>/diag`, and `/script/<id>/ble-scan`.

## AUTO / MANUAL controls

`AUTO` and `MANUAL` control the main Shelly automation script named
`Local Climate Link Thermostat`.

```text
AUTO: start the thermostat script. Do not force relay ON.
MANUAL: stop the thermostat script and set relay OFF.
ON/OFF: manually control only the relay.
```

If the app shows `Najpierw zapisz regułę dla tego gniazdka.`, the saved Shelly
does not have the main thermostat script yet. Go to `Reguła`, choose the Shelly
and thermometer, then use `Zapisz i wyślij`.

## Script upload failed

In demo mode, upload uses `FakeShellyClient` and does not contact a real Shelly.
In hardware setup, upload uses local Shelly RPC against the selected saved plug.

Check:

```text
Shelly reachable by RPC
existing script stopped before PutCode
existing Local Climate Link script backup attempted
script size below limits
chunked PutCode when needed
Script.GetStatus error code
Script.GetStatus reports running
```

## Relay test failed

Action:

```text
always send final OFF
if final OFF fails, report that final state could not be confirmed
show recovery button: Wyłącz relay teraz
show diagnostics
stop automation if uncertain
```

## Sensor stale

User message:

```text
Nie widzę czujnika od X minut. Dla bezpieczeństwa gniazdko zostało wyłączone.
```

Possible actions:

```text
check battery
move sensor closer
increase stale timeout only if advertising interval requires it
lower rssiMin carefully
```

## TP357 not found

User message:

```text
Nie widzę jeszcze termometru BLE.
```

Action: keep the TP357 close to the selected Shelly, wait for a few advertisements, and run the Shelly BLE scan again. The discovery script expects the advertisement to expose a `TP357` local name and manufacturer data.

Generated TP357 runtime scripts use the MatrixHub manufacturer-data parser. If discovery works but runtime diagnostics stay stale, record the raw advertisement and compare it with the MatrixHub payload model.
