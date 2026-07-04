# Repository Guide

This document keeps technical project information out of the public-facing
README.

## Quick start

```bash
corepack enable
pnpm install
pnpm dev
```

The dev server opens the demo mobile shell from `apps/mobile`. The demo flow does
not require BLE hardware, Shelly hardware, cloud, MQTT, Home Assistant, Docker,
YAML, or a background phone process.

Use `pnpm` only. Do not add npm or yarn lockfiles.

## Main commands

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm format
pnpm format:check
pnpm quality:ux
pnpm e2e:responsive
pnpm tokens:build
pnpm check
pnpm check:landing
pnpm check:full
```

Quality gates:

```bash
pnpm quality:ux        # static UX/style guardrails
pnpm e2e:responsive   # responsive smoke across phone/tablet/desktop viewports
pnpm check            # format, lint, UX gate, typecheck, tests, coverage, build
pnpm check:landing    # landing page deploy gate
pnpm check:full       # check + responsive smoke
```

Git hooks:

```text
pre-commit -> lint-staged + pnpm quality:ux
pre-push   -> pnpm check
```

## Git branch model

The repository uses two intentionally separate branch roles:

```text
work -> day-to-day development branch with normal commit history
main -> release-only branch with one snapshot commit per public version
```

Do not use a normal merge from `work` into `main`. A public release should be
prepared on `work`, verified, tagged, uploaded to GitHub Releases, and then
copied to `main` as a versioned snapshot commit. This keeps `main` readable as a
release ledger while preserving full implementation history on `work`.

The release flow is:

1. Work on `work` and run `pnpm check`.
2. Build and verify Android artifacts with `LCL_RELEASE_VERSION=<version> pnpm release:android`.
3. Upload APK/AAB/checksums to the matching GitHub Release.
4. Create the version snapshot on `main` from the verified `work` tree and tag it.
5. Push `work`, `main`, and the tag.

## Landing page

```bash
pnpm dev:landing
pnpm check:landing
pnpm build:landing
```

The public page is deployed through GitHub Pages using
`.github/workflows/pages.yml`.

Current public URL:

```text
https://michalmatu.github.io/local-climate-link-starter/
```

## Android release artifacts

Release builds require the local signing environment before running the release
command:

```bash
set -a
source ~/.local-climate-link/android-signing/release-signing.env
set +a
LCL_RELEASE_VERSION=2.0.4 pnpm release:android
```

The release script builds the web app, syncs Capacitor, builds APK/AAB, collects
artifacts under `artifacts/releases/v<version>/`, verifies checksums, and checks
Android signatures. Do not upload artifacts if `verify-android-release.mjs`
fails.

## Make shortcuts

```bash
make help
make start
make stop
make status
make test
make check
make diagnose
```

Hardware helpers use local environment variables:

```bash
SHELLY_URL=http://<shelly-ip> make shelly-status
SHELLY_URL=http://<shelly-ip> make shelly-diag
SHELLY_URL=http://<shelly-ip> SENSOR_MAC=<aa:bb:cc:dd:ee:ff> make shelly-install
SHELLY_URL=http://<shelly-ip> make shelly-soak-start
SHELLY_URL=http://<shelly-ip> SOAK_CYCLE_RELAY=1 make shelly-soak-run
make shelly-soak-status
make shelly-soak-stop
ESP32_URL=http://<esp32-ip> make esp32-ble-status
```

`make start` runs Vite in the background and writes PID/logs under `.make/`.
`make shelly-soak-start` runs the Shelly diagnostic logger in the background and
writes JSONL, stdout log, and Markdown summary under `artifacts/hardware/`.

## Hardware smoke helper

```bash
SHELLY_URL=http://<shelly-ip> SENSOR_MAC=<aa:bb:cc:dd:ee:ff> pnpm hardware:shelly:install
```

Useful overrides:

```text
SENSOR_PROFILE=xiaomi_lywsd03mmc_bthome_v2 | tp357_custom_v1
RSSI_MIN=-100
OBSERVE_MS=15000
ON_THRESHOLD=19
OFF_THRESHOLD=20
```

The helper generates the Shelly script from typed config, installs it through
local RPC, polls diagnostics when available, and sends a final `Switch.Set` OFF.

## Soak testing

Start a long-running logger and stop it later:

```bash
SHELLY_URL=http://<shelly-ip> SCRIPT_ID=1 SOAK_CYCLE_RELAY=1 make shelly-soak-start
make shelly-soak-status
make shelly-soak-stop
```

Foreground mode:

```bash
SHELLY_URL=http://<shelly-ip> SCRIPT_ID=1 make shelly-soak-run
```

Overnight helper:

```bash
SHELLY_URL=http://<shelly-ip> SCRIPT_ID=1 make shelly-soak-overnight
```

Useful overrides:

```text
SOAK_INTERVAL_MS=5000
SOAK_RPC_TIMEOUT_MS=4000
SOAK_DURATION_MS=0
SOAK_OVERNIGHT_DURATION_MS=28800000
SOAK_OUT_FILE=artifacts/hardware/manual-soak.jsonl
SOAK_SCREEN_SESSION=lcl-soak
SOAK_CYCLE_RELAY=1
SOAK_CYCLE_PERIOD_MS=120000
SOAK_CYCLE_MIN_CHANGE_MS=1000
SOAK_CYCLE_MAX_ON_MS=180000
SOAK_CYCLE_CONSECUTIVE_HITS=1
SOAK_FINAL_OFF=1
SOAK_STOP_SCRIPT_ON_FINISH=1
```

`SOAK_DURATION_MS=0` means the logger runs until `make shelly-soak-stop`.
Background mode uses `screen` when available. Active cycling uses the generated
runtime rule instead of directly toggling `Switch.Set`, so ON/OFF transitions
still pass through the production decision logic.

## Demo mode and dev console

The mobile setup UI is split into:

```text
Shelly -> Termometry -> Reguła -> Diag
```

During Vite/dev builds the app exposes a hidden browser-console API under
`window.lclDev`. It is intentionally not visible in normal navigation.

Useful commands:

```js
lclDev.help();
lclDev.menu();
lclDev.state();
lclDev.setLocale('de');
lclDev.resetLocale();
lclDev.setTheme('dark');
lclDev.setTheme('system');
lclDev.errors();
lclDev.clearErrors();
```

Supported app locales are `pl`, `en`, `de`, `es`, `fr`, `it`, and `pt-BR`.
Unsupported system languages fall back to English.

## Architecture summary

Runtime automation stays on Shelly. The app is the configurator and diagnostic
surface.

```text
BLE advertisement
  -> ble-core parser/demo scanner
  -> device profile compatibility
  -> automation-core rule model
  -> script-generator Shelly Script
  -> shelly-client upload/test path
  -> diagnostics export
```

Important packages:

```text
apps/mobile                 Ionic React + Capacitor shell
apps/landing                GitHub Pages landing page
packages/automation-core    pure decision engine and simulator
packages/ble-core           BLE scanner interface and parsers
packages/device-profiles    Xiaomi/TP357/Shelly profiles
packages/shelly-client      Shelly RPC client, fake client, safe relay test
packages/script-generator   deterministic Shelly Script generator
packages/design-tokens      token source, CSS variables, TS exports
packages/ui                 presentational React components
packages/diagnostics        bounded logger, redaction, support summary
```

Generated script variants:

```text
xiaomi-bthome-minimal
tp357-minimal
```

JSON config is the source of truth. Generated Shelly script text is output, not
hand-edited runtime state.

## Generated examples

Sample typed configs:

- `examples/sample-configs/xiaomi-bthome-heating.json`
- `examples/sample-configs/tp357-heating.json`

Generated scripts:

- `examples/shelly-scripts/xiaomi-bthome-heating.generated.js`
- `examples/shelly-scripts/tp357-heating.generated.js`

## CI

GitHub Actions runs:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm quality:ux
pnpm typecheck
pnpm test
pnpm build
pnpm e2e:responsive
```

GitHub Pages runs:

```bash
pnpm check:landing
```

## Detailed docs

- `AGENTS.md`
- `docs/plan.md`
- `docs/architecture/overview.md`
- `docs/implementation/adapter-contracts.md`
- `docs/implementation/vertical-slices.md`
- `docs/parser-sources.md`
- `docs/security/230v-safety.md`
- `docs/testing/hardware-matrix.md`
- `docs/product/next-functional-steps.md`
