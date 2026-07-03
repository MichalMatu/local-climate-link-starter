# Sensor compatibility

## Official MVP support

| Sensor                      | Format                  | Status | Notes                                                                                 |
| --------------------------- | ----------------------- | ------ | ------------------------------------------------------------------------------------- |
| Xiaomi LYWSD03MMC with PVVX | unencrypted BTHome v2   | target | First supported sensor. App assumes already flashed/configured with the preset below. |
| TP357                       | custom ThermoPro beacon | target | Parser follows the MatrixHub TP357 manufacturer-data model.                           |

## Current implementation behavior

```text
Xiaomi BTHome v2:
  - demo reading is available in the app
  - ble-core parses fixture payloads for temperature, humidity, battery, voltage, short humidity, and short temperature
  - the mobile app can connect to PVVX over phone BLE during setup to import stored memo readings and set thermometer time
  - Shelly-side discovery can list nearby BTHome candidates by runtime MAC and RSSI
  - generated Shelly Script contains a compact local BTHome v2 runtime parser aligned with the supported app-side object set
  - real Shelly matrix passed heating/cooling/humidifying/dehumidifying with VPD off/on
  - encrypted BTHome is rejected as unsupported in MVP

TP357:
  - demo reading is available in the app
  - ble-core parses MatrixHub-style TP357 manufacturer data
  - Shelly-side discovery can list TP357 candidates when advData contains the TP357 name
  - generated Shelly Script contains the TP357 runtime parser
  - real Shelly matrix passed heating/cooling/humidifying/dehumidifying with VPD off/on
  - mobile charts currently use live advertisement samples only
  - stored TP357 history needs a separate phone GATT reader and is planned as day-history first
```

## Xiaomi / PVVX MVP preset

Use this preset before treating a Xiaomi LYWSD03MMC as supported:

```text
Firmware: PVVX / ATC custom firmware
Advertising type: BTHome v2
Encryption: off
Advertising flags: on
Advertising interval: about 1000 ms
Measure interval: about 10 s
RF TX power: high enough for stable Shelly RSSI in the target room
Runtime address source: Shelly-side BLE discovery
```

The runtime parser supports these unencrypted BTHome v2 object IDs:

```text
0x00 packet id
0x01 battery
0x02 temperature, sint16, factor 0.01 °C
0x03 humidity, uint16, factor 0.01 %
0x0c voltage, uint16, factor 0.001 V, telemetry-only skip in runtime
0x2e humidity, uint8, factor 1 %
0x45 temperature, sint16, factor 0.1 °C
```

Phone BLE scanning is setup UX only. On iOS the phone scan identifier is not a
runtime MAC address; use Shelly-side BLE discovery to choose the address that
the generated Shelly Script will filter at runtime.

PVVX memo history and time setting are also setup-only phone BLE operations. They
do not change the runtime architecture: after setup, Shelly still reads BLE
advertisements locally and controls the relay without the phone.

## Not MVP

| Sensor/format            | Decision              | Reason                                |
| ------------------------ | --------------------- | ------------------------------------- |
| Encrypted BTHome         | later                 | Requires key flow and more testing.   |
| Mijia encrypted          | later                 | Requires bind key flow.               |
| Random Tuya thermometers | not supported         | Too many revisions/protocol variants. |
| Zigbee thermometers      | separate product path | Requires Zigbee coordinator/hub.      |
