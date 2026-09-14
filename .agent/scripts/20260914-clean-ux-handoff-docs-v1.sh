#!/usr/bin/env bash
set -euo pipefail
REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=0fbe83040ae0e41f932bb83a65a8b3438c26ba1b
VISUAL_SOURCE=56a90240029ce19690e96ad02057cc4150ba537f
cd "$REPO"

git fetch origin "$BRANCH" main
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
git clean -fd
[ "$(git rev-parse HEAD)" = "$EXPECTED" ] || { echo "Unexpected work HEAD: $(git rev-parse HEAD)"; exit 2; }
MAIN_ARTIFACT_COMMIT=$(git rev-parse origin/main)
DOCS_BEFORE=$(find docs -type f | wc -l | tr -d ' ')
BYTES_BEFORE=$(find docs -type f -print0 | xargs -0 cat | wc -c | tr -d ' ')

rm -f \
  docs/SANDBOX_EXECUTION_FLOW.md \
  docs/plan.md \
  docs/ux-polish-backlog.md \
  docs/implementation/adapter-contracts.md \
  docs/implementation/device-rule-decoupling-astra-prompt.md \
  docs/implementation/device-rule-decoupling-plan.md \
  docs/implementation/device-rule-decoupling-progress.md \
  docs/implementation/vertical-slices.md \
  docs/product/next-functional-steps.md \
  docs/troubleshooting/mvp.md
rm -rf docs/prompts
mkdir -p docs/product docs/troubleshooting

cat > docs/HANDOFF_NEXT_CHAT.md <<'EOF'
# Next chat handoff — UX restoration

Updated: 2026-09-14

## Mission

The next chat has one primary goal: restore the stronger visual hierarchy and interaction quality of the pre-refactor app **without rolling back the independent device/rule architecture**.

Work on `work/device-rule-decoupling-20260913`. Treat `main` only as a visual reference. Do not merge `main` into the work branch and do not restore old product files wholesale.

## Exact reference points

- Product-code checkpoint before this documentation-only cleanup: `0fbe83040ae0e41f932bb83a65a8b3438c26ba1b`.
- Old visual source tree: `56a90240029ce19690e96ad02057cc4150ba537f` on `main`.
- Canonical physical Android reference screenshots: `artifacts/ux-reference/main-20260914/` on `main`.
- Screenshot artifact commit: `__MAIN_ARTIFACT_COMMIT__`.
- Reference device: Samsung SM-S906B.

The screenshot commit changes reference artifacts only; the app code being photographed is the old visual source tree above.

## Current product architecture — preserve this

Plugs, thermometers and automation rules are independent durable entities.

- Plug store: `lcl.plugs.v1`.
- Sensor store: `lcl.sensors.v1`.
- Rule store: `lcl.rules.v1`.
- Durable sensor-to-plug association exists only through a climate rule.
- Rule names and device names are independent.
- Exactly one rule may own a `(plugId, relayId)` pair.
- Desired rule configuration is separate from deployment state.
- Climate deployment is not complete until exact script identity/hash and safety verification succeed.
- Direct relay control is allowed only when live ownership/inventory proves the relay is unowned.
- Runtime and persistence failures are explicit; do not infer success from a completed mutation.

Current top-level navigation is **Rules / Plugs / Thermometers / Settings**. Keep this information architecture. The old `Climate / Time / Settings` navigation belongs only to the visual reference app.

## Runtime invariants — do not change for UX work

Climate AUTO/MANUAL is the in-process `R.m` protocol of the exact managed script.

- AUTO: `R.m = 0`.
- MANUAL: `R.m = 1`, automatic relay decisions blocked.
- Normal mode changes never use `Script.Stop` / `Script.Start`.
- Unknown or unreadable mode fails closed; never coerce it to AUTO.
- AUTO -> MANUAL and MANUAL -> AUTO are OFF-first and verified.
- Temporary BLE discovery keeps the climate process alive in MANUAL/OFF, runs the separate discovery script, then restores the exact prior mode.
- Time rules own exact native Shelly Schedule job ids.
- Climate active hours remain part of the climate runtime, not native time-rule ownership.
- Any destructive or hardware test must finish with verified relay OFF.

See `docs/architecture/runtime-control.md` and `docs/architecture/refactor-boundaries.md` before touching runtime behavior.

## Current UI seams

Routes are composed in `apps/mobile/src/routes/AppRoutes.tsx`:

- Rules dashboard: `AutomationDashboardScreen`.
- Plug management: `PlugManagementScreen`.
- Thermometer management: `SensorManagementScreen`.
- Goal selection: `SetupIntentScreen`.
- Create/edit rule: `RuleEditorScreen`.
- Rule detail/runtime controls: `RuleDetailScreen`.
- Settings: `AppSettingsScreen`.

Screens should stay orchestration/presentation surfaces. Persistence, RPC, ownership and lifecycle transactions belong in focused flows/services.

## What to restore from the old UX

Use the canonical screenshots as the primary visual baseline. Restore patterns, not old state ownership:

- compact, legible cards with clear primary status and restrained technical detail;
- stronger spacing and typography hierarchy;
- consistent round/add actions and compact contextual navigation;
- task-sized modals with one clear purpose and no nested modal chains;
- progressive disclosure for advanced/developer information;
- balanced control geometry, especially time/schedule controls;
- the custom HH/MM wheel interaction where it is better than a native time input;
- concise transient progress in the active task surface; global toasts only when the result remains relevant after the task closes;
- technical identifiers available in detail/diagnostic views, while normal summaries prefer saved human names.

Do not force the old screen topology onto the new product model. Adapt the visual language to Rules / Plugs / Thermometers / Settings.

## Explicitly forbidden rollback paths

Do not reintroduce:

- `InstalledAutomation` as the durable product model;
- `lcl.installedAutomations.*` reads/writes;
- persisted `setupDraftStore` / `lcl.hardwareSetupDraft.*`;
- `HardwareSetupScreen` or `useHardwareSetupFlow` as a product orchestrator;
- sensor ownership by a plug;
- copied/stale plug endpoints inside rules;
- legacy migrations, compatibility readers, dual writes or adapters for removed development schemas;
- AUTO/MANUAL inferred from `Script.List.running`;
- BLE discovery that stops/restarts climate as a mode-preservation mechanism.

Git history is the archive for those implementations; active docs intentionally no longer describe them.

## Recommended UX restoration order

1. Compare current physical/work-branch screens against `artifacts/ux-reference/main-20260914/`.
2. Stabilize shared tokens/primitives only when a repeated visual problem justifies it.
3. Restore Rules dashboard and Rule detail hierarchy.
4. Restore Plug and Thermometer management layout/modals.
5. Restore Rule editor layout, schedule/day controls and time wheel interaction.
6. Restore Settings and diagnostics/progressive disclosure.
7. Run a physical Samsung audit and fix touch/scroll/overflow issues.
8. Finish with `pnpm check:full` and Android build/install smoke.

During the visual iteration, prefer focused format/lint/typecheck/component or E2E checks. Do not run the full suite after every tiny visual change.

## First action in the next chat

Read, in this order:

1. this file;
2. `docs/product/ux-restoration.md`;
3. `docs/architecture/overview.md`;
4. `docs/architecture/refactor-boundaries.md`;
5. `docs/architecture/runtime-control.md`.

Then inspect the canonical `main` screenshots and start with one current screen at a time. Do not begin another architecture rewrite.
EOF
sed -i '' "s/__MAIN_ARTIFACT_COMMIT__/$MAIN_ARTIFACT_COMMIT/g" docs/HANDOFF_NEXT_CHAT.md

cat > docs/architecture/overview.md <<'EOF'
# Architecture overview

## Product boundary

Local Climate Link is a phone configurator and diagnostic/control surface for local Shelly automation. Long-running climate logic executes on the Shelly device; the phone does not need a background service and no cloud, MQTT broker or Home Assistant instance is required for the default flow.

The current product model is intentionally independent from the older setup-wizard/installation model.

## Durable entities

Three registries are composed by `apps/mobile/src/flows/registry/devicesAndRules.ts`:

| Entity | Storage key | Identity / lifetime |
| --- | --- | --- |
| Plug | `lcl.plugs.v1` | Physical Shelly device; endpoint can change without changing identity |
| Sensor | `lcl.sensors.v1` | BLE thermometer profile + normalized runtime address |
| Rule | `lcl.rules.v1` | Automation intent/configuration plus deployment metadata |

A sensor is never owned by a plug. A climate rule references one plug and one sensor. A time rule references a plug but no sensor. Device names and rule names are independent mutable presentation fields.

The registries enforce cross-reference safety: device removal is rejected while a rule references the device. Storage errors are typed and cannot be reported as successful persistence.

There are no active compatibility readers, migrations or dual writes for the removed development schemas.

## Rule ownership and lifecycle

Exactly one rule may own a `(plugId, relayId)` pair. Ownership is verified against current device/rule state and live Shelly inventory before remote mutation.

`flows/rules/lifecycle.ts` is the transaction boundary for create, deploy, verify, edit/redeploy, pause, resume, recover and delete. Desired configuration and deployment state remain distinct so partial remote/local failures can be represented truthfully.

Climate deployment records exact managed script identity/hash and a safety-test state. Time deployment records exact native Schedule job ids. Removing deployed resources requires ownership verification and safe cleanup first.

## Runtime safety

All plug mutations resolve current physical identity and use the per-plug operation queue. Direct relay control fails closed when inventory is unreadable, identity does not match, or a rule owns the relay.

Climate AUTO/MANUAL is the live `R.m` protocol of the exact managed script:

- `R.m = 0`: AUTO;
- `R.m = 1`: MANUAL;
- stopped/missing are process/deployment states, not user mode;
- unknown/unreadable mode is an error and never becomes AUTO by assumption.

Mode transitions are OFF-first and verified. Ordinary mode changes do not stop/start the script. See `runtime-control.md` for the exact ordering.

Temporary Shelly-side BLE discovery preserves the exact prior climate mode. The climate process remains running in MANUAL with verified OFF while a separate discovery script temporarily owns BLE scanning. Cleanup removes the discovery script, restarts climate BLE scanning and restores the prior mode. Unknown prior mode blocks the operation.

Any destructive/hardware test must leave the relay OFF and verify that final state.

## Time automation

Time rules use native Shelly Schedule jobs and own only the exact job ids stored in rule deployment metadata. Schedule creation, update, pause/resume and deletion are transactional.

Climate active-hours constraints are a climate-runtime concern and do not become native time-rule ownership.

## Mobile application structure

`AppRoutes.tsx` exposes the current information architecture:

```text
Rules
Plugs
Thermometers
Settings
```

Important screens:

- `AutomationDashboardScreen`: rule list / primary product home;
- `PlugManagementScreen`: independent plug inventory and safe direct management;
- `SensorManagementScreen`: independent thermometer inventory;
- `SetupIntentScreen`: choose a new rule goal;
- `RuleEditorScreen`: create/edit desired rule configuration;
- `RuleDetailScreen`: deployment/runtime state and lifecycle actions;
- `AppSettingsScreen`: application settings/support information.

Screens compose UI and flow hooks. They do not implement persistence transactions, RPC protocols or runtime ownership algorithms.

## Package / service boundaries

- `packages/automation-core`: deterministic rule logic.
- `packages/ble-core`: BLE normalization/parsing.
- `packages/device-profiles`: supported sensor/output profiles.
- `packages/script-generator`: deterministic Shelly runtime generation.
- `packages/shelly-client`: RPC/inventory/schedule/script clients.
- `packages/ui`: reusable presentational primitives.
- `packages/design-tokens`: visual tokens.
- `packages/diagnostics`: bounded/redacted diagnostics utilities.
- `apps/mobile/src/flows/devices`: device repositories/stores/management.
- `apps/mobile/src/flows/rules`: rule model/selectors/lifecycle/runtime services.
- `apps/mobile/src/flows/hardware-setup`: narrow discovery/diagnostic/validation helpers only; it is not a durable setup store or product orchestrator.

## Source-of-truth hierarchy

When documents disagree, prefer current source/tests, then accepted ADRs and current architecture docs. Completed plans, implementation prompts and progress diaries are intentionally removed from active documentation; use Git history for archaeology.
EOF

cat > docs/product/ux-restoration.md <<'EOF'
# UX restoration roadmap

Updated: 2026-09-14

## Goal

Restore the mature visual/interaction quality of the pre-refactor app while keeping the current independent device/rule architecture unchanged.

The canonical visual reference is `artifacts/ux-reference/main-20260914/` on `main`. The app code photographed there comes from `main` tree `56a90240029ce19690e96ad02057cc4150ba537f`.

That old tree is **not** an architecture reference.

## Preserve the current product model

The restoration must keep:

- Rules / Plugs / Thermometers / Settings as the top-level information architecture;
- global independent plug and sensor registries;
- rule ownership of plug/sensor relationships;
- rule/device name independence;
- exact deployment ownership and fail-closed runtime behavior;
- climate `R.m` mode semantics;
- native Schedule ownership for time rules;
- no legacy storage migrations/readers/dual writes.

Visual work should not create a second orchestration path.

## Visual language to recover

Use screenshots rather than memory. High-value patterns from the old UX are:

- compact cards with one dominant status/value and secondary details visually quieter;
- clear page headers and predictable contextual back/cancel actions;
- consistent add/FAB affordances;
- balanced two-column controls where values are peers;
- task modals sized around one action, not full-screen generic containers;
- progressive disclosure for advanced/developer controls;
- custom HH/MM wheel picker with centered selection and top/bottom fade where time selection benefits from it;
- concise scanner/status feedback inside the task being performed;
- readable dark/light theming and tokenized spacing/radii;
- human-readable names in normal UI, with IP/MAC/script ids retained in technical detail views.

Do not copy old navigation labels or old installation/setup ownership simply because they appear in the screenshots.

## Implementation order

### 1. Baseline comparison

Capture the same key states on the work branch and compare them side by side with the canonical `main` set. Record only concrete regressions: hierarchy, spacing, control geometry, modal behavior, scrolling, touch targets, density and missing feedback.

### 2. Shared primitives only where justified

Fix tokens/primitives when several screens share the same defect. Avoid a new design-system rewrite. Reuse current `packages/ui`, design tokens and theme CSS.

### 3. Rules surfaces

Restore the Rules dashboard and Rule detail first because they define the product's main visual language. Keep runtime controls truthful and ownership-aware.

### 4. Device management

Restore compact Plug and Thermometer list cards, add/settings modals and scanning feedback. Device pages remain global inventories, not rule-scoped wizard steps.

### 5. Rule editor

Restore clear selection fields, threshold geometry, progressive advanced options and polished scheduling. Weekday/time controls should be compact and symmetric. Prefer the established wheel interaction over a raw native time field when it works reliably on Android.

### 6. Settings / diagnostics

Keep normal settings short. Put service/developer detail behind progressive disclosure or dedicated diagnostic surfaces. Avoid nested modals.

### 7. Physical acceptance

Audit on Samsung SM-S906B after the visual series. Check touch targets, keyboard behavior, modal scroll, bottom navigation, status-bar/safe-area spacing and horizontal overflow.

## Iteration/testing policy

For small visual fixes, run focused checks: Prettier, targeted ESLint, mobile typecheck and focused tests/E2E where relevant. Group heavy checks at the end of a coherent UX iteration.

Final acceptance:

```bash
pnpm check:full
pnpm --filter @lcl/mobile build
pnpm --filter @lcl/mobile exec cap sync android
```

Then build/install the Android debug app and do a physical smoke. Hardware/rule behavior must not be changed to make screenshots look better.

## Out of scope for this pass

- new automation types or hardware profiles;
- VPD algorithm redesign;
- cloud/MQTT/Home Assistant features;
- architecture rollback;
- legacy schema compatibility;
- broad refactors motivated only by file size.
EOF

cat > docs/troubleshooting/current.md <<'EOF'
# Current troubleshooting

This file describes the current independent device/rule architecture. Use Git history for behavior of removed setup/installation flows.

## Shelly cannot be registered or refreshed

Check local reachability, the current saved endpoint and physical identity. Product mutations resolve the saved plug again after entering the per-plug operation queue; a stale URL or a different physical device must fail rather than mutate the wrong Shelly.

Useful checks:

```text
Shelly.GetDeviceInfo
Shelly.GetStatus
Script.List
Switch.GetStatus
Schedule.List
```

Matter may block the Scripts-based climate path on supported firmware. A time rule or basic plug registration must not require climate BLE/script support.

## Climate deployment fails

Upload alone is not success. The lifecycle must retain the exact script id/hash, establish a safe MANUAL/OFF state and complete verification before the deployment is considered healthy.

Check:

```text
current plug identity matches the saved plug
relay ownership is not conflicting
script inventory is readable
Matter / Scripts / BLE support is valid for climate
Script.GetStatus is running without runtime errors
local persistence succeeded after the remote mutation
safetyTest is verified before AUTO
```

If a remote mutation succeeds but local attachment fails, recovery should leave truthful local state and best-effort clean up the newly created remote artifact.

## AUTO / MANUAL is unknown

`Script.List.running` is not the user's control mode. The exact running climate script stores mode in `R.m` and is read through the mode protocol.

```text
AUTO   -> R.m = 0
MANUAL -> R.m = 1
```

Unknown/unreadable mode fails closed. Do not infer AUTO. Normal mode changes do not call `Script.Stop` or `Script.Start`.

## BLE discovery

Shelly-side BLE discovery temporarily shares the device with the climate runtime safely:

1. verify exact climate ownership and read the current mode;
2. put the running climate runtime into MANUAL and verify relay OFF;
3. run the separate discovery script;
4. remove that exact discovery script;
5. restart climate BLE scanning;
6. restore and verify the exact prior AUTO/MANUAL mode.

A previously stopped climate runtime remains stopped. Duplicate managed scripts or an unreadable prior mode block discovery. Cleanup failure must fail closed and leave the relay OFF.

If no thermometer appears, check sensor battery/advertising, Shelly Bluetooth, distance/RSSI, unencrypted BTHome v2 for Xiaomi/PVVX, and the runtime address expected by the selected sensor profile.

## Sensor data is stale

A stale or unusable control reading must never keep a climate output ON indefinitely. Check advertising interval, battery, distance and parser/profile match before increasing the stale timeout.

For Xiaomi/PVVX, temperature and humidity can arrive in separate advertisements and are composed only inside the bounded runtime freshness window. Battery-only/incomplete frames are telemetry, not a valid control measurement.

## Direct plug control is blocked

This is expected when a rule owns the relay or when inventory/identity is not trustworthy. Direct ON/OFF is for an unowned relay only. Do not bypass the ownership resolver from UI code.

## Time rule conflict

Time rules own exact native Shelly Schedule jobs. Creation/update must fail on an existing climate owner, conflicting native schedule ownership, unreadable inventory, missing schedule capacity or unsynchronized device time when required by the lifecycle.

Do not delete unrelated Schedule jobs to make room.

## Delete/recover cannot prove cleanup

Destructive operations verify exact script/job ownership before mutation. If cleanup is partial, show the recovery state instead of pretending deletion completed. The final relay state must be OFF and verified whenever the operation touches output ownership.

## Android app issues

For the development Samsung device:

```bash
/opt/homebrew/bin/adb devices
/opt/homebrew/bin/adb shell am force-stop link.localclimate.app
/opt/homebrew/bin/adb shell am start -W -n link.localclimate.app/.MainActivity
```

Use `scripts/android/phone-alpha-install.sh` for the normal alpha install workflow. Do not clear app data unless the test explicitly requires a clean-state run.

## Hardware-test safety

Real relay tests are allowed only against the explicitly authorized development plug. Every helper/test must attempt final OFF in cleanup and verify `Switch.GetStatus.output == false`. If OFF cannot be verified, report it as a blocking failure.
EOF

cat > docs/testing/hardware-matrix.md <<'EOF'
# Hardware validation matrix

This file is a compact statement of currently validated hardware and the repeatable tests that matter. Historical run-by-run logs belong in Git history and generated artifacts, not in this document.

## Supported / validated devices

| Device | Role | Current evidence |
| --- | --- | --- |
| Shelly Plug S Gen3 (`S3PL-00112EU`) | controller/output | Firmware 1.7.5 validated with local scripts, BLE and real relay transitions |
| Xiaomi LYWSD03MMC + PVVX BTHome v2 | climate sensor | Real Shelly-side BLE/runtime matrix passed |
| TP357 | climate sensor | Parser + real Shelly-side BLE/runtime matrix passed |
| Samsung SM-S906B (S22+) | Android configurator | Physical debug install/navigation used for acceptance and UX reference capture |

The final 2026-07-04 real-runtime matrix passed 16/16 combinations on Shelly Plug S Gen3 firmware 1.7.5: Xiaomi/PVVX and TP357, heating/cooling/humidifying/dehumidifying, VPD off/on. Each case observed real BLE and relay ON/OFF and ended with the relay OFF.

Historical intermediate failures on older firmware/weak advertisements remain available in Git history; they are not current support conclusions.

## Current architecture smokes

### Independent plug/rule ownership

`scripts/hardware/device-rule-plug-smoke.ts` verifies the current registry/ownership model on an explicitly authorized development plug:

- register the physical plug and verify identity;
- keep zero rules and verify direct ON then OFF;
- install only the test run's exact script;
- inventory it as an orphan and block direct control while it owns runtime resources;
- delete the exact orphan;
- keep the plug registered;
- verify final relay OFF in `finally`.

Run with:

```bash
SHELLY_URL=http://<shelly-ip> \
SHELLY_DEVICE_ID=<normalized-device-id> \
pnpm exec tsx scripts/hardware/device-rule-plug-smoke.ts
```

The smoke requires a clean plug with no scripts or native schedules and never removes pre-existing resources to prepare the test.

### Climate mode + BLE discovery preservation

`scripts/hardware/runtime-mode-smoke.ts` verifies both prior-mode paths:

```text
MANUAL -> discovery running -> MANUAL
AUTO   -> discovery running -> AUTO
```

The climate process stays running while discovery owns BLE temporarily. Cleanup deletes the discovery script, restores the exact prior `R.m` mode and verifies final relay OFF.

Run with the same `SHELLY_URL` / `SHELLY_DEVICE_ID` environment variables.

## Legacy/full-runtime helpers still available

These helpers remain useful for generator/runtime validation and soak work:

```text
scripts/hardware/shelly-install-thermostat.ts
scripts/hardware/shelly-real-matrix.ts
scripts/hardware/shelly-soak-logger.ts
```

Root package commands include:

```bash
pnpm hardware:shelly:install
pnpm hardware:shelly:matrix
pnpm hardware:shelly:soak
```

Use generated artifacts under `artifacts/hardware/` for detailed run evidence rather than expanding this matrix into a chronological diary.

## Support rule

Before marketing a hardware combination as supported, require:

- real hardware pass on a recorded firmware version;
- parser/profile tests committed;
- safe relay ON/OFF and stale/failsafe behavior validated where applicable;
- power/restart behavior validated for the controller path;
- final relay OFF verified;
- compatibility/troubleshooting docs updated when behavior changes.

## Safety invariant

Every real relay test must finish with an explicit OFF attempt and a read-back verification. Never leave the development plug ON after a smoke, matrix, soak or cleanup path.
EOF

cat > docs/development/repository-guide.md <<'EOF'
# Repository guide

Technical development notes live here; the root README stays product-facing.

## Quick start

```bash
corepack enable
pnpm install
pnpm dev
```

Use `pnpm` only. Do not add npm/yarn lockfiles.

## Main quality commands

```bash
pnpm format:check
pnpm lint
pnpm quality:ux
pnpm quality:repo
pnpm typecheck
pnpm test
pnpm test:coverage:core
pnpm build
pnpm e2e:responsive
pnpm check
pnpm check:full
```

`pnpm check:full` is the final integration gate: format, lint, UX/repository gates, typecheck, tests, core coverage, build and responsive E2E.

During a rapid visual iteration, use focused checks and run `check:full` at the end of a coherent batch rather than after each CSS adjustment.

## Branch model

`main` is the release branch. Substantial work should use a short-lived `work/<topic>` branch and integrate only after full verification.

`agent-control` is Local Agent control-plane state, not product code. `freeze/*` may exist only as immutable rollback/audit references.

Current UX restoration work must continue on `work/device-rule-decoupling-20260913`. The old `main` app is used only as a visual reference; do not merge it into the refactored branch.

## Current mobile information architecture

```text
Rules
Plugs
Thermometers
Settings
```

The old `Climate / Time / Settings` navigation and installation/setup-wizard model are historical. Current routes are composed in `apps/mobile/src/routes/AppRoutes.tsx`; create/edit rule flows use the independent device/rule registries.

## Architecture summary

Runtime automation stays on Shelly. The app is the configurator, device/rule manager and diagnostic/control surface.

```text
BLE/profile data
  -> device profile / parser
  -> desired rule config
  -> deterministic script or native Schedule deployment
  -> exact deployment ownership
  -> live status / diagnostics / lifecycle control
```

Important areas:

```text
apps/mobile/src/flows/devices   plug/sensor persistence and management
apps/mobile/src/flows/rules     rule model, lifecycle, ownership and runtime services
apps/mobile/src/flows/runtime   shared runtime mode protocol
packages/automation-core        deterministic rule engine
packages/ble-core               BLE normalization/parsers
packages/device-profiles        hardware profiles
packages/shelly-client          Shelly RPC/inventory/schedule clients
packages/script-generator       deterministic Shelly scripts
packages/ui                     presentational primitives
packages/design-tokens          visual tokens
packages/diagnostics            diagnostics/redaction utilities
```

See `docs/architecture/overview.md`, `refactor-boundaries.md` and `runtime-control.md` for current invariants.

## Android development

Normal alpha workflow:

```bash
pnpm android:phone-alpha
```

Manual build/sync:

```bash
pnpm --filter @lcl/mobile build
pnpm --filter @lcl/mobile exec cap sync android
cd apps/mobile/android
./gradlew assembleDebug
```

The development package is `link.localclimate.app`.

## Hardware helpers

Real hardware actions require explicit target environment variables. Current architecture smokes:

```bash
SHELLY_URL=http://<shelly-ip> SHELLY_DEVICE_ID=<device-id> \
  pnpm exec tsx scripts/hardware/device-rule-plug-smoke.ts

SHELLY_URL=http://<shelly-ip> SHELLY_DEVICE_ID=<device-id> \
  pnpm exec tsx scripts/hardware/runtime-mode-smoke.ts
```

Legacy/full-runtime generator tests remain available through `pnpm hardware:shelly:install`, `hardware:shelly:matrix` and `hardware:shelly:soak`.

All real relay helpers must finish with verified OFF. See `docs/testing/hardware-matrix.md`.

## Landing and release

```bash
pnpm dev:landing
pnpm check:landing
pnpm build:landing
```

Android release:

```bash
set -a
source ~/.local-climate-link/android/release-signing.env
set +a
pnpm release:android
```

Use the Google Play registered upload key. Do not publish artifacts when release verification fails.

## Current documentation map

Start from these files instead of historical plans:

```text
docs/HANDOFF_NEXT_CHAT.md
docs/architecture/overview.md
docs/architecture/refactor-boundaries.md
docs/architecture/runtime-control.md
docs/product/ux-restoration.md
docs/testing/hardware-matrix.md
docs/troubleshooting/current.md
```

Accepted ADRs and compatibility/release/security documents remain durable references. Completed implementation prompts/plans/progress logs are intentionally removed; use Git history when historical context is needed.
EOF

cat > README.md <<'EOF'
# Local Climate Link

**Thermostat without a hub.**

Local Climate Link configures local climate and time automation on Shelly hardware. Climate rules use BLE thermometer data and a local Shelly script; time rules use native Shelly schedules. The phone is the configurator and control/diagnostic surface, not a required 24/7 runtime.

The default flow requires no cloud, Home Assistant, MQTT broker or background server.

## Current supported climate path

```text
Xiaomi LYWSD03MMC / PVVX BTHome v2
or TP357
        ↓
Shelly Plug S Gen3
        ↓
local climate script + relay
```

The app also supports independent plug/thermometer management and local time rules on compatible Shelly outputs.

## Status

The project is in MVP/beta. Current development is focused on preserving the completed independent device/rule architecture while restoring the stronger UX of the earlier application shell.

## Downloads

Latest published Android beta:

```text
https://github.com/MichalMatu/local-climate-link-starter/releases/latest
```

The repository currently publishes v2.0.10 APK/AAB assets through GitHub Releases. iOS installation files are not published yet.

## Project page

```text
https://michalmatu.github.io/local-climate-link-starter/
```

## Developer documentation

- [Next chat / active work handoff](docs/HANDOFF_NEXT_CHAT.md)
- [Architecture overview](docs/architecture/overview.md)
- [Refactor boundaries](docs/architecture/refactor-boundaries.md)
- [Runtime control](docs/architecture/runtime-control.md)
- [UX restoration roadmap](docs/product/ux-restoration.md)
- [Repository guide](docs/development/repository-guide.md)
- [Hardware matrix](docs/testing/hardware-matrix.md)
- [Current troubleshooting](docs/troubleshooting/current.md)

Historical implementation plans and prompts are intentionally not kept as active documentation; Git history is the archive.

## License

Local Climate Link is source-available under a noncommercial license. Commercial use, app store distribution, product bundling or paid services require written permission or a separate commercial license.

Copyright (c) 2026 Michal Matuszewski. See [LICENSE](LICENSE).
EOF

python3 - <<'PY'
from pathlib import Path
p=Path('docs/adr/ADR-0006-independent-devices-and-rules.md')
s=p.read_text()
s=s.replace('Accepted (user-authorized implementation plan, 2026-09-13).','Accepted and implemented (2026-09-13/14).')
s=s.replace('Existing product\ncallers are switched in the subsequent implementation phases; the old product\nmodels are removed when that switch is complete.','The old product persistence/orchestration models have been removed; current callers use the independent registries and rule lifecycle services.')
p.write_text(s)
PY

# Format only documentation touched by this cleanup.
pnpm exec prettier --write \
  README.md \
  docs/HANDOFF_NEXT_CHAT.md \
  docs/architecture/overview.md \
  docs/product/ux-restoration.md \
  docs/troubleshooting/current.md \
  docs/testing/hardware-matrix.md \
  docs/development/repository-guide.md \
  docs/adr/ADR-0006-independent-devices-and-rules.md

# Stale positive contracts must not survive in active docs.
! grep -R -nE 'loadSetupDraft|saveSetupDraft|loadInstalledSetup|saveInstalledSetup|Zustand setup draft|stops the main automation while scanning|Automation is stopped during scan' docs README.md

# Removed active-document filenames must not be referenced.
! grep -R -nE 'SANDBOX_EXECUTION_FLOW|device-rule-decoupling-(astra-prompt|plan|progress)|vertical-slices|ux-polish-backlog|troubleshooting/mvp|next-functional-steps|implementation/adapter-contracts' docs README.md AGENTS.md

pnpm exec prettier --check README.md docs
pnpm quality:repo

DOCS_AFTER=$(find docs -type f | wc -l | tr -d ' ')
BYTES_AFTER=$(find docs -type f -print0 | xargs -0 cat | wc -c | tr -d ' ')
echo "DOCS_BEFORE=$DOCS_BEFORE DOCS_AFTER=$DOCS_AFTER"
echo "DOC_BYTES_BEFORE=$BYTES_BEFORE DOC_BYTES_AFTER=$BYTES_AFTER"
git status --short

git add -A README.md docs
git commit --no-verify -m "Clean documentation for UX handoff"
git push origin "$BRANCH"
FINAL_HEAD=$(git rev-parse HEAD)
REMOTE_HEAD=$(git ls-remote origin "refs/heads/$BRANCH" | awk '{print $1}')
[ "$FINAL_HEAD" = "$REMOTE_HEAD" ]
echo "MAIN_ARTIFACT_COMMIT=$MAIN_ARTIFACT_COMMIT"
echo "FINAL_HEAD=$FINAL_HEAD"
