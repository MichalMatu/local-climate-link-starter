# Sensor compatibility

## Official MVP support

| Sensor                      | Format                  | Status | Notes                                                                           |
| --------------------------- | ----------------------- | ------ | ------------------------------------------------------------------------------- |
| Xiaomi LYWSD03MMC with PVVX | unencrypted BTHome v2   | target | First supported sensor. App assumes already flashed/configured in MVP skeleton. |
| TP357                       | custom ThermoPro beacon | target | Parser follows the MatrixHub TP357 manufacturer-data model.                     |

## Current implementation behavior

```text
Xiaomi BTHome v2:
  - demo reading is available in the app
  - ble-core parses fixture payloads for temperature, humidity, and battery
  - Shelly-side discovery can list nearby BTHome candidates by runtime MAC and RSSI
  - generated Shelly Script contains a compact local BTHome v2 runtime parser
  - real Shelly matrix passed heating/cooling/humidifying/dehumidifying with VPD off/on
  - encrypted BTHome is rejected as unsupported in MVP

TP357:
  - demo reading is available in the app
  - ble-core parses MatrixHub-style TP357 manufacturer data
  - Shelly-side discovery can list TP357 candidates when advData contains the TP357 name
  - generated Shelly Script contains the TP357 runtime parser
  - real Shelly matrix passed heating/cooling/humidifying/dehumidifying with VPD off/on
```

## Not MVP

| Sensor/format            | Decision              | Reason                                |
| ------------------------ | --------------------- | ------------------------------------- |
| Encrypted BTHome         | later                 | Requires key flow and more testing.   |
| Mijia encrypted          | later                 | Requires bind key flow.               |
| Random Tuya thermometers | not supported         | Too many revisions/protocol variants. |
| Zigbee thermometers      | separate product path | Requires Zigbee coordinator/hub.      |
