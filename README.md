# Local Climate Link

**Thermostat without a hub.**

Local Climate Link is an app for local climate automation:

```text
BLE thermometer -> Shelly Plug S Gen3 -> local relay ON/OFF
```

The app does not need to run in the background. You configure the rule once, then
the script uploaded to Shelly receives BLE beacons and controls the plug locally.

## What the app does

- finds and checks Shelly Plug S Gen3,
- supports BLE thermometers: Xiaomi LYWSD03MMC / PVVX BTHome v2 and TP357,
- lets you set your own temperature, humidity, and VPD thresholds,
- generates and uploads a local Shelly Script,
- shows diagnostics: last reading, RSSI, Shelly firmware, relay state, and
  decision reason,
- works without cloud, Home Assistant, MQTT, or a 24/7 server.

## Supported MVP setup

```text
Xiaomi LYWSD03MMC / PVVX / BTHome v2
or TP357 custom BLE beacon
        ↓
Shelly Plug S Gen3
        ↓
local script and relay ON/OFF
```

## Status

The project is in MVP/beta. The current priority is one stable path:
Xiaomi/PVVX or TP357 + Shelly Plug S Gen3.

## Downloads

The latest Android beta build is available in GitHub Releases:

Release page (always points to the newest published version):

```text
https://github.com/MichalMatu/local-climate-link-starter/releases/latest
```

Direct assets for the current published release (v2.0.8):

- [Android APK v2.0.8](https://github.com/MichalMatu/local-climate-link-starter/releases/download/v2.0.8/local-climate-link-v2.0.8-android-release.apk)
  for direct installation on Android.
- [Android App Bundle v2.0.8](https://github.com/MichalMatu/local-climate-link-starter/releases/download/v2.0.8/local-climate-link-v2.0.8-android-release.aab)
  for Play Store/internal testing workflows.
- [SHA-256 checksums](https://github.com/MichalMatu/local-climate-link-starter/releases/download/v2.0.8/local-climate-link-v2.0.8-sha256.txt)
  for file verification.

iOS installation files are not published yet.

## Project page

```text
https://michalmatu.github.io/local-climate-link-starter/
```

## For developers

Technical notes, commands, tests, and repository structure are kept outside the
main README:

- [docs/development/repository-guide.md](docs/development/repository-guide.md)
- [docs/development/sandbox-execution-flow.md](docs/development/sandbox-execution-flow.md)
- [docs/testing/hardware-matrix.md](docs/testing/hardware-matrix.md)
- [docs/product/next-functional-steps.md](docs/product/next-functional-steps.md)

## License

Local Climate Link is source-available under a noncommercial license. Commercial
use, app store distribution, product bundling, or paid services require written
permission or a separate commercial license.

Copyright (c) 2026 Michal Matuszewski. See [LICENSE](LICENSE).
