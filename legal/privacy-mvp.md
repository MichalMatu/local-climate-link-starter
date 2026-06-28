# Privacy MVP

Local Climate Link is local-first.

## Default data flow

By default, the app processes data locally on the user's phone and on the user's Shelly device in the local network.

Default MVP behavior:

```text
No cloud account required.
No Home Assistant required.
No MQTT broker required.
No analytics SDK required.
No third-party telemetry by default.
No diagnostic upload by default.
```

## Data handled locally

The app may handle:

- BLE advertisements from supported sensors,
- temperature, humidity, battery level, RSSI, and last-seen timestamps,
- Shelly local IP/model/firmware/script status,
- generated automation configuration,
- diagnostic logs created during setup.

## Diagnostics

Diagnostics export must be user-initiated. Before export, show what will be included and redact secrets by default.

Do not include by default:

- Wi-Fi passwords,
- auth tokens,
- raw full diagnostic payloads unless explicitly enabled,
- unrelated BLE devices,
- unrelated local network scan results.

## Future changes

Any analytics, crash reporting, cloud backup, remote support, or marketplace profile sync requires a separate product decision, opt-in UX, and documentation update.
