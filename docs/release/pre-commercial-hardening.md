# Pre-commercial hardening plan

This is the work to finish before spending effort on store packaging,
payment, or public marketing. The goal is evidence-based confidence in the
current MVP: Shelly Plug S Gen3 + Xiaomi/PVVX BTHome v2 + TP357.

## Priority

Do this first:

```text
1. Run serious smoke tests.
2. Add missing tests where the smoke tests expose risk.
3. Review architecture, package boundaries, and god-object risk.
4. Review UI consistency, styles, tokens, and responsive behavior.
5. Update docs so the repo matches the product behavior.
6. Only then return to commercial release work.
```

## 1. Smoke and hardware evidence

Required release-candidate evidence:

- Xiaomi/PVVX is detected by phone BLE and Shelly-side BLE.
- TP357 is detected by phone BLE and Shelly-side BLE.
- Xiaomi/PVVX manual history fetch works after app restart.
- Sensor chart samples survive app force-stop and relaunch.
- Shelly script upload succeeds from a clean plug state.
- Safe relay test toggles ON and OFF and ends OFF.
- Heating ON threshold works.
- Heating OFF threshold works.
- Humidifying ON/OFF thresholds work.
- Dehumidifying ON/OFF thresholds work.
- VPD assist behaves inside the configured humidity range.
- Stale sensor timeout turns the relay OFF.
- Shelly reboot starts safe OFF.
- Matter ON blocks script install with clear copy.
- Diagnostics show firmware, script, relay, BLE, Matter, and last reading.
- Diagnostics export contains no secrets.

Record dated results in `docs/testing/hardware-matrix.md`.

## 2. Test coverage to add or confirm

Focus tests on behavior that can break safety or trust:

- BLE parser fixtures for every real Xiaomi and TP357 payload shape seen in
  hardware tests.
- Malformed payloads and missing fields for both parsers.
- Xiaomi/PVVX memo history parsing, empty history, timeout, and GATT cleanup.
- Sensor chart persistence and bounded sample retention.
- Rule logic for exact threshold edges.
- `minChangeMs`, stale timeout, max ON, boot OFF, and consecutive-hit guards.
- Generated Shelly Script snapshots for every supported profile and mode.
- Runtime matrix for VPD off/on across humidifying/dehumidifying.
- E2E responsive checks for every modal with mobile viewport.
- Clipboard/copy fallback on web preview.
- Permission-denied and BLE-unavailable states.

## 3. Architecture and code audit

Review for these risks:

- React screens doing domain logic.
- Direct Capacitor BLE calls outside adapters/flows.
- Direct Shelly RPC calls outside `packages/shelly-client`.
- Script-generation logic duplicated in UI.
- Parser behavior duplicated between TypeScript and generated script without
  shared fixtures.
- Unbounded arrays for logs, BLE scan results, or chart samples.
- Hidden global state or stale subscriptions.
- `any` or stringly typed command names.
- Large files that now act as god objects.

If a file is too large, split only along real responsibilities. Do not refactor
for aesthetics alone.

## 4. UI, styles, and tokenization audit

Check every screen and modal for:

- No standalone left-aligned action buttons unless intentionally full width.
- Primary modal actions live in footer/header patterns, not random body rows.
- No duplicated headings or filler explanations.
- No raw hex colors in app components.
- No hardcoded spacing except trivial `0`.
- No non-token breakpoint values.
- No clipped tooltips.
- No horizontal overflow on phone, tablet, or desktop.
- Stable chart dimensions.
- Consistent chart scale and no jumpy one-sample sparkline behavior.
- Accessible names for icon buttons.
- Error states use clear user copy and do not shift primary controls.

Run:

```text
pnpm quality:ux
pnpm quality:repo
LCL_E2E_PORT=5174 pnpm e2e:responsive
```

Use a non-default E2E port when another local Vite server owns `5173`.

## 5. Documentation audit

Keep these files aligned with tested reality:

- `README.md`
- `docs/architecture/overview.md`
- `docs/compatibility/sensors.md`
- `docs/compatibility/outputs.md`
- `docs/parser-sources.md`
- `docs/testing/hardware-matrix.md`
- `docs/troubleshooting/mvp.md`
- `docs/release/store-readiness.md`
- `legal/THIRD_PARTY_NOTICES.md`

Documentation should say clearly:

- the phone configures, Shelly runs the automation;
- Xiaomi/PVVX supports stored memo history;
- TP357 currently uses live BLE samples only;
- no cloud, MQTT, Home Assistant, or background phone automation is required;
- relay safety tests are allowed and must end in a known final state.

## 6. Release quality gate

Before commercial packaging, run and keep the output clean:

```text
pnpm format:check
pnpm lint
pnpm quality:ux
pnpm quality:repo
pnpm typecheck
pnpm test
pnpm test:coverage:core
pnpm build
LCL_E2E_PORT=5174 pnpm e2e:responsive
```

Then install on a real Android phone and run the hardware smoke matrix.

## Software-only audit status — 2026-09-09

Completed before the next phone session:

- Installation Health & Recovery is merged: offline, stopped script, stale sensor
  data, and ownership mismatch have focused user-facing states. Recovery remains
  conservative: read-only refresh or the existing verified script resume path.
- Exact-source Linux sandbox `check:full` passes, including responsive Playwright
  smoke, workspace builds, and 100% coverage gates for `automation-core` and
  `script-generator`.
- The same health/recovery change passed the macOS Local Agent full gate and
  canonical GitHub CI before merge.
- Visual audit passed at `360x800`, `390x844`, `412x915`, and `768x1024` for
  installation detail/recovery, Shelly setup, and the advanced modal with no
  horizontal overflow or clipped primary controls.
- Responsive E2E now uses the three representative phone viewports required by
  `AGENTS.md`, plus tablet and desktop coverage.
- Component tests explicitly prove that offline, stale-sensor, and ownership
  recovery refreshes do not call `Script.Start`, `Script.Stop`, or `Switch.Set`.
- `pnpm quality:repo` now guards Android/package version consistency, internal
  workspace dependency cycles, screen network/BLE boundaries, and domain-package
  React/Ionic boundaries. It runs as part of `pnpm check`.
- Package dependency audit found no internal cycles and no React/Ionic imports in
  domain packages. Screens do not directly call Shelly RPC or the Capacitor BLE
  plugin.
- Large setup files (`useHardwareSetupFlow.ts`, `ShellySetupPage.tsx`,
  `RuleSetupPage.tsx`, `SensorSetupPage.tsx`) remain maintainability risks, but
  are intentionally not split before first phone testing without a concrete
  responsibility boundary and regression reason.
- Android release version defaults were corrected to use the root package version
  instead of the stale hard-coded `2.0.5`; docs now match `2.0.9` / `20009`.
- Native Android preflight passes on macOS after configuring Android SDK 36:
  Capacitor sync, `assembleDebug`, and `lintDebug` completed successfully; the
  generated debug APK was 4.2 MB.
- Android Gradle Plugin 8.7.2 emits a non-blocking compatibility warning for
  `compileSdk = 36` because that plugin version declares testing through API 35.
  Keep the warning visible for a later release-toolchain upgrade rather than
  suppressing it just to silence logs.
- The firmware summary now reflects the final 2026-07-04 Shelly 1.7.5 real BLE
  16/16 matrix while preserving earlier failed attempts as historical evidence.

Still requires a real device / native environment before calling the product
release-ready:

- signed Android release/AAB build on the configured SDK and registered upload key;
- clean install/upgrade and lifecycle checks on a real Android phone;
- real phone BLE permission/scan behavior and Capacitor networking;
- one final Shelly + Xiaomi/PVVX + TP357 smoke pass after installing the candidate;
- signed release/AAB verification with the registered Play upload key.

## Deferred commercial plan

Return to this only after the hardening checklist above is complete:

1. Build signed Android `APK` and `AAB`.
2. Create GitHub Release `v2.x`.
3. Attach installable Android artifacts to the release.
4. Publish or verify the GitHub Pages landing page.
5. Add release/download links to the landing page and README.
6. Prepare store assets: icon, screenshots, short description, privacy policy,
   support contact, and hardware compatibility copy.
7. Open or configure Google Play developer account.
8. Ship Android first; evaluate iOS after Android evidence is stable.
