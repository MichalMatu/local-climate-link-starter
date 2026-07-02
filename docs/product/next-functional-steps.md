# Local Climate Link — Functional Next Steps

This file tracks product extensions after the current Shelly + Xiaomi/PVVX +
TP357 MVP. It is intentionally separate from `docs/plan.md`, which describes
the current MVP boundary.

## Rules for future expansion

- Keep Shelly as the runtime controller. The phone remains a configurator and
  diagnostic tool.
- Do not add cloud, Home Assistant, MQTT, telemetry, or background phone
  automation as a default requirement.
- Add one vertical slice at a time: domain model, script generation, UI,
  diagnostics, docs, and tests.
- Prefer bounded local data over unbounded logs. Shelly runtime memory is a
  product constraint, not an implementation detail.
- Every new user-facing feature needs i18n coverage for all supported app
  locales.

## 1. Climate history and charts

Goal: show users what the thermometer and relay did over time without requiring
a separate datalogger.

Recommended order:

1. Add a pure `ClimateSample` model with timestamp, temperature, humidity, VPD,
   RSSI, relay state, sensor profile, and source.
2. Add deterministic demo sample fixtures for landing page screenshots and app
   previews.
3. Build a lightweight SVG chart component with no new runtime dependency:
   temperature, humidity, VPD, and relay ON/OFF markers.
4. Add local app-side history while the diagnostics screen is open.
5. Add optional export to JSON/CSV for support and marketing screenshots.
6. Consider a tiny Shelly ring buffer only after memory testing confirms it is
   safe. The buffer must be bounded and disabled when memory gets tight.

Required tests:

- VPD calculation and chart range helpers,
- downsampling and empty-history behavior,
- i18n labels,
- responsive chart rendering,
- no unbounded arrays in runtime or diagnostics paths.

## 2. PVVX/Xiaomi setup assistant

Goal: reduce setup mistakes for Xiaomi LYWSD03MMC with PVVX/BTHome v2 firmware.

Scope:

- Add a read-only guide for recommended PVVX settings first.
- Later, evaluate a Web Bluetooth configuration helper as an optional tool, not
  as a required setup path.
- Do not copy upstream flasher code without license review and notices.
- Keep encrypted BTHome/bind key support out of the default MVP unless it gets a
  separate decision record.

Recommended PVVX guidance fields:

- BTHome v2 advertising type,
- unencrypted beacon for MVP,
- advertising interval tuned for reliability and battery,
- measurement interval,
- transmit power,
- visible battery reporting.

Required tests/docs:

- compatibility guide update,
- troubleshooting for missing Xiaomi advertisements,
- legal notice review before embedding any upstream behavior.

## 3. Reliability cockpit

Goal: make support and field testing faster.

Scope:

- Add a compact reliability summary: last seen, stale count, RSSI range, relay
  changes, last OFF reason, firmware, script hash, and Matter/Scripts status.
- Add a support export that redacts IP/MAC unless the user explicitly includes
  them.
- Keep the UI compact. Avoid large cards for a handful of diagnostic values.

Required tests:

- diagnostics redaction,
- stale-state copy,
- script hash drift detection,
- no raw secrets in exported payloads.

## 4. Rule presets and guardrails

Goal: make common climate automations safer to configure.

Candidate presets:

- humidifier between humidity min/max,
- dehumidifier between humidity min/max,
- heater with max continuous ON time,
- cooling with compressor-safe minimum change interval,
- VPD assist operating inside the configured humidity range.

Required tests:

- exact threshold behavior,
- min-change guard,
- stale OFF,
- max-ON guard,
- generated script snapshots for each preset.

## 5. Additional hardware paths

Only expand after the current Xiaomi/PVVX, TP357, and Shelly Plug S Gen3 path is
stable in dated hardware tests.

Possible order:

1. More Shelly Gen3 plug variants with the same Scripts/BLE runtime capability.
2. Additional BTHome v2 unencrypted sensors.
3. Optional NOUS/Tasmota path only after a separate architecture decision.

Every new hardware path needs:

- profile schema,
- parser fixtures,
- generated script support,
- compatibility docs,
- troubleshooting docs,
- manual hardware matrix entry.

## 6. Commercial packaging

Goal: turn the MVP into something sellable without weakening privacy or safety.

Next steps:

- Android beta distribution page and APK release notes.
- Play Store developer account and store listing assets.
- Privacy policy and support contact flow.
- Landing page beta signup flow.
- Clear licensing and third-party notices.
- Hardware compatibility landing section with tested firmware versions.

Do not add analytics SDKs or telemetry before an explicit product decision and
opt-in UX.

## Suggested immediate sequence

1. Finish and publish the GitHub Pages landing page.
2. Add a demo climate chart to the landing/app preview using generated samples.
3. Add app-side diagnostics history while the diagnostics screen is open.
4. Export diagnostics/history to JSON/CSV.
5. Re-run overnight Shelly soak tests with the exported history format.
