# Local Climate Link

Ultra-light mobile configurator for local BLE -> Shelly automations.

```text
Termostat bez huba.
Termometr BLE + gniazdko Shelly.
Konfigurujesz raz w aplikacji, działa lokalnie.
```

The phone is not the runtime controller. The app discovers devices, validates compatibility, generates a typed Shelly Script config, uploads the script, runs a safe relay test, and shows diagnostics. After setup, Shelly is the runtime controller.

## Quick Start

```bash
corepack enable
pnpm install
pnpm dev
```

The dev server runs the demo mobile shell from `apps/mobile`. No BLE hardware, LAN scan, Shelly device, cloud, MQTT broker, Home Assistant, Docker, YAML, or background phone automation is required for the demo flow.

## Project Commands

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm test:watch
pnpm format
pnpm format:check
pnpm precommit
pnpm prepush
pnpm quality:ux
pnpm e2e:responsive
pnpm tokens:build
pnpm hardware:shelly:install
pnpm check
pnpm check:full
```

Use `pnpm` only. Do not add npm or yarn lockfiles.

## Quality Gates

The repository uses Prettier, ESLint, TypeScript, Vitest, a custom UX gate, and
Playwright responsive smoke tests.

```bash
pnpm quality:ux        # static UX/style guardrails
pnpm e2e:responsive   # responsive smoke across phone/tablet/desktop viewports
pnpm check            # fast local gate
pnpm check:full       # check + responsive smoke
```

Husky installs Git hooks through `pnpm prepare`:

```text
pre-commit -> lint-staged + pnpm quality:ux
pre-push   -> pnpm check
```

The responsive smoke test starts the mobile Vite app and checks the hardware setup
tabs for horizontal overflow on small phone, phone, tablet, and desktop viewports.

## Make Shortcuts

The root `Makefile` wraps the common commands:

```bash
make help
make start
make stop
make status
make test
make check
make diagnose
```

Hardware helpers take local environment variables:

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

`make start` runs Vite in the background and writes its PID/logs under `.make/`.
`make shelly-soak-start` runs a long Shelly diagnostic logger in the background
and writes JSONL, stdout log, and a Markdown summary under `artifacts/hardware/`.

## Hardware Smoke Helper

Use the helper for repeatable Shelly install/diagnostic tests:

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

The helper generates the Shelly script from typed config, installs it through local RPC,
polls the generated `/script/<id>/diag` endpoint when available, and always sends a
final `Switch.Set` OFF command.

For long stability checks, start a soak logger and stop it later:

```bash
SHELLY_URL=http://<shelly-ip> SCRIPT_ID=1 SOAK_CYCLE_RELAY=1 make shelly-soak-start
make shelly-soak-status
make shelly-soak-stop
```

For an overnight active soak, use the 8-hour helper:

```bash
SHELLY_URL=http://<shelly-ip> SCRIPT_ID=1 make shelly-soak-overnight
```

Use foreground mode when a supervising terminal/session should own the long run:

```bash
SHELLY_URL=http://<shelly-ip> SCRIPT_ID=1 make shelly-soak-run
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
SOAK_CYCLE_MARGIN=
SOAK_CYCLE_MIN_CHANGE_MS=1000
SOAK_CYCLE_MAX_ON_MS=180000
SOAK_CYCLE_CONSECUTIVE_HITS=1
SOAK_FINAL_OFF=1
SOAK_STOP_SCRIPT_ON_FINISH=1
```

`SOAK_DURATION_MS=0` means the background logger runs until
`make shelly-soak-stop`; foreground mode runs until Ctrl-C.
Each sample stores raw endpoint responses plus parsed fields for BLE freshness,
relay state, decision reason, RSSI, Shelly memory, and plug telemetry.
Background mode uses `screen` when available, which is the preferred path for
multi-hour and overnight tests on macOS. `make shelly-soak-stop` still sends
SIGINT to the logger so it can write the summary, stop the Shelly script, and
leave the relay OFF.

Set `SOAK_CYCLE_RELAY=1` for a real ON/OFF endurance run. The logger then uses
`Script.Eval` every `SOAK_CYCLE_PERIOD_MS` to move the running script thresholds
around the latest real sensor value. It does not directly call `Switch.Set` for
the cycle; the next real BLE measurement still has to pass through the generated
runtime logic and change the relay by rule. This keeps the long test close to
the production behavior while making ON and OFF transitions likely during a
multi-hour run. Active cycling captures the original runtime thresholds before
the first cycle, uses a longer test-time `maxOnMs`, stops the script when the
logger stops, and leaves the relay OFF by default. Use
`SOAK_STOP_SCRIPT_ON_FINISH=0` only when you intentionally want the installed
automation to continue after the soak.

## Demo Mode

The app opens on a manual MVP hardware setup split into simple top-menu pages:

```text
Shelly -> Termometry -> Reguła -> Diag
```

The setup UI supports Polish and English from the same typed i18n key tree.
The app selects the language from the system browser/webview language. Polish is
used for `pl`/`pl-PL`; every unsupported language falls back to English. There is
no manual language switch in the MVP UI. New languages should be added by
creating another locale file under `apps/mobile/src/app/locales/`, registering it
in `apps/mobile/src/app/i18n.ts`, and running the i18n tests that verify key
parity and block hardcoded Polish copy outside the locale files.

Xiaomi/PVVX BTHome v2 and TP357 are the MVP sensor profiles. Both have parser
coverage, generated Shelly runtime variants, and dated Shelly Plug S Gen3 smoke
results in `docs/testing/hardware-matrix.md`.

The current hardware setup draft is saved locally in the app/browser storage:
saved Shelly plugs with manual IP addresses and names, saved Xiaomi/PVVX
thermometers with names, the selected Shelly/sensor pair, rule parameter,
thresholds, optional VPD assist target, RSSI minimum, stale timeout,
`minChangeMs`, max ON time, diagnostic choices, and saved names survive screen
remounts and ordinary app reloads. The generated script preview and
`Zapisz i wyślij` action live on the `Reguła` page.

During `pnpm dev`, the mobile web preview routes Shelly requests through a local
Vite-only proxy. This keeps the browser flow usable when Shelly answers local RPC
and `/script/<id>/diag` or `/script/<id>/ble-scan` without
`Access-Control-Allow-Origin` on the final response. The proxy is limited to
private/local Shelly targets and the MVP RPC, diagnostics, and BLE discovery
paths.

The Shelly page can scan a local IPv4 range for plugs. The network scanner skips
Shelly plugs already saved in the app, checks up to eight addresses in parallel,
and stops at the first new Shelly response. A scan result is already verified by
`Shelly.GetDeviceInfo`, so pressing `Dodaj` saves it directly without returning
to the manual IP form.

The Shelly page can also start a temporary Shelly-side BLE discovery script from
a saved plug. Pressing `Skanuj BLE` opens the modal and immediately starts the
scan. During that scan the app sets the relay OFF, stops the main automation
script if it is running, polls `/script/<id>/ble-scan` every few seconds, and then
stops the scanner and restarts the automation when the modal is closed.

Saved Shelly plugs also expose direct local controls:

```text
ON / OFF      manual relay control
AUTO          start Local Climate Link Thermostat
MANUAL        stop Local Climate Link Thermostat and leave relay OFF
```

The demo screen still implements a hardware-free vertical slice in code and tests:

```text
start -> fake Xiaomi + fake TP357 readings -> fake Shelly Plug S Gen3
      -> heating thresholds -> generated Shelly Script preview
      -> fake upload -> fake safe relay test -> diagnostics
```

The demo also has an explicit Matter-enabled blocked scenario so the UI path is visible before real hardware integration. The fake safe relay test always ends OFF.

Generated configs now include both app identity and Shelly runtime identity:

```text
sensor.sensorId        app/demo identity
sensor.runtimeAddress Shelly-side BLE address used by the runtime script
```

The demo runtime addresses are simulated and are marked that way in diagnostics.

## MVP Test Status

Version `1.0.0` is the current MVP test candidate. The software demo, parser
fixtures, deterministic automation matrix, script-generation matrix, and latest
Shelly Plug S Gen3 hardware audit are documented in
`docs/testing/hardware-matrix.md`.

The product is ready for user hardware tests on the documented MVP path:

```text
Xiaomi/PVVX BTHome v2 or TP357
  -> Local Climate Link app setup
  -> Shelly Plug S Gen3 local script
  -> local relay automation
```

Manual validation is still required on each target device/firmware before
marketing broader compatibility.

## Implemented Packages

```text
apps/mobile                 Ionic React + Capacitor shell, demo wizard
packages/automation-core    pure heating decision engine and simulator
packages/ble-core           BLE scanner interface, BTHome parser, demo scanner, Capacitor shell
packages/device-profiles    Zod schemas and Xiaomi/TP357/Shelly profiles
packages/shelly-client      RPC interfaces, fetch transport, fake client, safe relay test
packages/script-generator   deterministic Shelly Script generator
packages/design-tokens      token source, CSS variables, TS exports
packages/ui                 presentational React components
packages/diagnostics        bounded logger, redaction, support summary
```

## Architecture Summary

The app composes packages. Domain logic lives outside React screens:

```text
BLE advertisement
  -> ble-core parser/demo scanner
  -> device profile compatibility
  -> automation-core rule model
  -> script-generator Shelly Script
  -> shelly-client upload/test path
  -> diagnostics export
```

Runtime automation remains on Shelly. The app now has real local Shelly RPC
paths for manual IP checks, LAN scanning, script upload, diagnostics, and
Shelly-side BLE discovery. Demo mode remains available for hardware-free tests.

The generated Xiaomi BTHome runtime script uses Shelly BLE scanning on the device:

```text
BLE.Scanner.subscribe -> BLE.Scanner.start -> minimal BTHome v2 parser
```

The final runtime script is generated as a minimal per-sensor variant:
`xiaomi-bthome-minimal` or `tp357-minimal`. It filters by runtime MAC, RSSI,
stale timeout, max ON time, minimum change interval, and consecutive threshold
hits. The rule can optionally use VPD assist: the configured temperature or
humidity thresholds remain the safe limits, while Shelly shifts the effective
ON/OFF thresholds toward the selected VPD target when both temperature and
humidity are available.

Shelly Plug S Gen3 firmware `1.2.3-matter22` did not expose a global
`BTHome.parseData`, so the Xiaomi runtime includes only the small BTHome v2
object parser needed for packet id, battery, temperature, and humidity. TP357
remains a separate runtime and does not include BTHome parser code.

The BLE discovery script is separate and temporary. The app uploads it only for
the scan modal, polls `/script/<id>/ble-scan`, then stops and deletes it before
returning to the runtime automation. `Script.PutCode` chunking only solves upload
size; runtime memory/code-space limits still require small generated scripts.

## Generated Examples

Sample typed configs:

- `examples/sample-configs/xiaomi-bthome-heating.json`
- `examples/sample-configs/tp357-heating.json`

Generated scripts:

- `examples/shelly-scripts/xiaomi-bthome-heating.generated.js`
- `examples/shelly-scripts/tp357-heating.generated.js`

JSON config is the source of truth; generated script text is not hand-edited runtime state.

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

## Read Order For Agents

1. `AGENTS.md`
2. `plan.md`
3. `docs/prompts/initial-codex-task.md`
4. `docs/architecture/overview.md`
5. `docs/implementation/adapter-contracts.md`
6. `docs/implementation/vertical-slices.md`
7. `docs/parser-sources.md`
8. `docs/security/230v-safety.md`
9. `docs/testing/hardware-matrix.md`
