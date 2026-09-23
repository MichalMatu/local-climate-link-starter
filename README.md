# Local Climate Link

**Thermostat without a hub.**

Local Climate Link is a local-first mobile app for configuring and managing Shelly Plug climate automation:

```text
BLE thermometer -> Shelly Plug S Gen3 -> local relay ON/OFF
```

The phone configures and diagnoses. The Shelly executes the installed automation locally, so the app does not need to remain open and the default product path does not require cloud services, Home Assistant, MQTT or a 24/7 server.

## What the app does

- discovers and manages Shelly Plug S Gen3 devices;
- supports Xiaomi LYWSD03MMC / PVVX BTHome v2 and TP357 BLE thermometers;
- supports up to 4 thermometers in one Climate automation with `avg`, `min`, `max` or `firstValid` aggregation;
- configures temperature, humidity and VPD rules;
- generates and manages a local Shelly Script runtime;
- exposes Plug, BLE, script and automation diagnostics without duplicating ownership;
- keeps device settings such as LED, physical button mode and Shelly Cloud separate from automation logic.

## Current product status

The project is in MVP/beta with a stable architecture and a verified real-hardware path on Samsung S22+ + Shelly Plug S Gen3.

The current development priority is **continued UX refinement of existing flows**. Do not start a new sensor/runtime capability until the current UX pass is accepted.

After UX stabilization, the next planned product expansions are:

1. BLE soil-moisture input through the existing typed sensor/config model;
2. a real-hardware feasibility spike for managing Shelly over BLE, reusing the same ownership and RPC transport boundaries.

See [Roadmap](docs/ROADMAP.md) and [Current handoff](docs/HANDOFF_NEXT_CHAT.md) for the exact next-session contract.

## Downloads

The latest Android beta build is available in GitHub Releases:

```text
https://github.com/MichalMatu/local-climate-link-starter/releases/latest
```

Current published release: **v2.0.10**.

- [Android APK v2.0.10](https://github.com/MichalMatu/local-climate-link-starter/releases/download/v2.0.10/local-climate-link-v2.0.10-android-release.apk)
- [Android App Bundle v2.0.10](https://github.com/MichalMatu/local-climate-link-starter/releases/download/v2.0.10/local-climate-link-v2.0.10-android-release.aab)
- [SHA-256 checksums](https://github.com/MichalMatu/local-climate-link-starter/releases/download/v2.0.10/local-climate-link-v2.0.10-sha256.txt)

## Project page

```text
https://michalmatu.github.io/local-climate-link-starter/
```

## Developer documentation

The active documentation set is intentionally small:

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Current handoff](docs/HANDOFF_NEXT_CHAT.md)
- [Hardware test matrix](docs/testing/hardware-matrix.md)

Repository operating rules live in [AGENTS.md](AGENTS.md) and the nearest directory-level `AGENTS.md` files.

## License

Local Climate Link is source-available under a noncommercial license. Commercial use, app store distribution, product bundling or paid services require written permission or a separate commercial license.

Copyright (c) 2026 Michal Matuszewski. See [LICENSE](LICENSE).
