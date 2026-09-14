#!/usr/bin/env bash
set -euo pipefail
REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
WORK_BRANCH=work/device-rule-decoupling-20260913
WORK_BASE=0fbe83040ae0e41f932bb83a65a8b3438c26ba1b
OLD_MAIN_BASE=56a90240029ce19690e96ad02057cc4150ba537f
cd "$REPO"

git fetch origin main "$WORK_BRANCH" agent-control

# Publish the already captured physical Samsung UX reference commit.
git checkout main
MAIN_LOCAL=$(git rev-parse HEAD)
MAIN_PARENT=$(git rev-parse HEAD^)
[ "$MAIN_PARENT" = "$OLD_MAIN_BASE" ] || { echo "Unexpected main parent: $MAIN_PARENT"; exit 2; }
[ "$(git log -1 --pretty=%s)" = "Refresh canonical main UX reference" ] || { echo "Unexpected main local commit: $MAIN_LOCAL"; exit 3; }
COUNT=$(find artifacts/ux-reference/main-20260914/android -name '*.png' -type f | wc -l | tr -d ' ')
[ "$COUNT" -ge 19 ] || { echo "Screenshot count too low: $COUNT"; exit 4; }
git push --no-verify origin main
MAIN_REF_HEAD=$(git rev-parse HEAD)
REMOTE_MAIN=$(git ls-remote origin refs/heads/main | awk '{print $1}')
[ "$MAIN_REF_HEAD" = "$REMOTE_MAIN" ] || { echo "Main push mismatch"; exit 5; }

# Prepare the implementation branch for a fresh chat.
git checkout "$WORK_BRANCH"
git reset --hard "origin/$WORK_BRANCH"
git clean -fd
[ "$(git rev-parse HEAD)" = "$WORK_BASE" ] || { echo "Unexpected work head: $(git rev-parse HEAD)"; exit 6; }

rm -f \
  docs/prompts/continue-e2e-freeze.md \
  docs/prompts/initial-codex-task.md \
  docs/prompts/local-climate-link-next-audit.md \
  docs/implementation/device-rule-decoupling-astra-prompt.md \
  docs/implementation/device-rule-decoupling-plan.md \
  docs/implementation/device-rule-decoupling-progress.md \
  docs/ux-polish-backlog.md
rmdir docs/prompts 2>/dev/null || true

export MAIN_REF_HEAD WORK_BASE
python3 - <<'PY'
from pathlib import Path
import os
main_ref = os.environ['MAIN_REF_HEAD']
work_base = os.environ['WORK_BASE']

Path('docs/HANDOFF_NEXT_CHAT.md').write_text(f'''# Local Climate Link — UX restoration handoff

Updated: 2026-09-14

## Start here

Work only in `MichalMatu/local-climate-link-starter` with Local Agent binding `e75c77cb-7589-4452-94b2-decc97ff85a1`.

Active implementation branch: `work/device-rule-decoupling-20260913`.
The last product/code checkpoint before this documentation-only cleanup is `{work_base}`.
Do not merge to `main` automatically.

## Goal for the next chat

Restore the **accepted v2.0.10 visual UX and interaction quality** while keeping the new independent Plug / Thermometer / Rule architecture and all useful new behavior.

This is not a rollback of the refactor. Preserve the new registries, rule ownership, lifecycle, deployment safety, LAN scan, device/rule independence, rule usage information, orphan-resource handling and current schedule logic. Reuse the old visual hierarchy, card composition, spacing, typography, menus and progressive disclosure as the reference surface, then fit the new logic into that design.

## Canonical old UX reference

Accepted application baseline (do not move):

- tag: `stable-20260912-v2.0.10-ux-polish`
- application SHA: `8173f0851adc77222fc3e98b02113ff28f7119fd`
- later `main` application tree before screenshots: `56a90240029ce19690e96ad02057cc4150ba537f` (the intervening commits were documentation / `.gitignore` only)

Fresh physical Samsung SM-S906B reference capture is committed on `main` at `{main_ref}`:

`artifacts/ux-reference/main-20260914/`

The Android folder contains 19 screenshots plus matching `.txt` DOM/body snapshots. Use these files as the visual source of truth instead of reconstructing the old UX from memory.

Key captures:

- `01-dashboard-climate.png`
- `02-climate-detail.png`
- `03-climate-detail-expanded.png`
- `04-settings.png` / `05-settings-expanded.png`
- `06-dashboard-time.png`
- `07-time-setup-shelly.png` / `08-time-add-plug.png`
- `09-time-schedule.png` / `10-time-wheel-picker.png`
- `11-setup-intent.png`
- `12-climate-setup-shelly.png` / `13-climate-add-plug.png`
- `14-climate-setup-sensors.png` / `15-add-thermometer.png`
- `16-climate-setup-rule.png` / `17-climate-rule-expanded.png`
- `18-rule-advanced-modal.png`
- `20-developer-diagnostics.png`

Old `artifacts/ui-audit/physical-20260910` captures were removed so there is one canonical physical reference set. Play Store assets were intentionally left alone because they are release assets, not audit history.

## Current architecture that must remain

- Plug, Sensor and Rule are independent durable entities (`lcl.plugs.v1`, `lcl.sensors.v1`, `lcl.rules.v1`).
- A sensor is global; durable sensor↔plug association exists only through a climate rule.
- Exactly one rule may own `(plugId, relayId)`.
- Rule and device names are independent.
- Climate AUTO/MANUAL is canonical in-process `R.m`; normal mode changes never stop/start the managed script.
- Unknown runtime mode fails closed.
- BLE discovery keeps the climate runtime alive in MANUAL/OFF, cleans up discovery, then restores the exact previous mode; it never guesses AUTO.
- Time rules own native Shelly schedules. Climate active hours stay in the climate script.
- Direct relay control is allowed only when ownership is known and unclaimed.
- Runtime mutation verifies exact physical/rule/script/schedule ownership and uses OFF-first safety.

Canonical technical docs: `docs/adr/ADR-0006-independent-devices-and-rules.md`, `docs/architecture/refactor-boundaries.md`, and `docs/architecture/runtime-control.md`.

## Current verification

At `{work_base}`:

- focused device UX regression E2E: 3/3 pass,
- full responsive E2E: 10/10 pass,
- `pnpm check:full`: pass,
- Android build/install/cold start on Samsung SM-S906B: pass, no fatal exception.

The old `main` build is currently the visual reference; do not infer current implementation quality from it.

## First next-chat task

Compare the current work-branch screens against the physical reference images **screen by screen**, starting with dashboard/device cards and menus. Make small reviewable visual changes, preserving current business logic. After each small UX batch run focused checks; run full `check:full` and Android acceptance only at the end of an iteration.
''', encoding='utf-8')

Path('docs/architecture/overview.md').write_text('''# Architecture overview

Local Climate Link is a phone configurator and management UI for automations that execute locally on Shelly hardware. The phone is required for setup/management, not for normal runtime control.

## Durable product model

The current app has three independent registries:

- **Plugs** — physical Shelly identity plus mutable endpoint and user name.
- **Thermometers** — physical/runtime BLE sensor identity plus user name.
- **Rules** — desired automation configuration plus deployment metadata and exact runtime ownership.

A thermometer is never owned by a plug. A climate rule is the only durable relationship between a sensor and a plug. Device names and rule names are independent. Exactly one rule can own a `(plugId, relayId)` pair.

Current storage keys are `lcl.plugs.v1`, `lcl.sensors.v1`, and `lcl.rules.v1`. The removed installation/setup-draft persistence model must not be recreated with compatibility readers, migrations, dual writes or adapters.

## Runtime split

### Climate rules

The generated Shelly script is a long-lived local runtime. It receives BLE advertisements, parses the configured sensor, applies threshold/VPD/failsafe logic, exposes diagnostics and controls the relay locally.

AUTO/MANUAL is the runtime's in-process `R.m` state. MANUAL keeps BLE and diagnostics alive while blocking automatic output. Unknown/unreadable mode fails closed. Normal mode switching never uses `Script.Stop`/`Script.Start`.

Temporary Shelly-side BLE discovery keeps the climate runtime alive in verified MANUAL/OFF, uses a separate discovery script/scanner session, cleans that session up, then restores the exact prior mode. If the prior mode cannot be read or restored, fail closed.

### Time rules

Pure time rules use Shelly native Schedule jobs. Exact job ids are stored in rule deployment metadata. Climate active-hour constraints are separate and remain inside the climate runtime.

## App boundaries

- `flows/devices/plugs` — plug persistence, registration and guarded direct operations.
- `flows/devices/sensors` — thermometer persistence and live sensor management.
- `flows/rules` — rule model/editor/lifecycle/runtime ownership/deployment.
- `flows/registry/devicesAndRules.ts` — composed independent registries.
- `flows/runtime` — shared runtime protocols and relay-safety primitives.
- `flows/hardware-setup` — narrow discovery/diagnostic/validation helpers only; no durable setup store.
- screens — route-level composition and presentation, not persistence/RPC/deployment algorithms.

Package-level BLE parsing, device profiles, Shelly RPC, script generation, automation logic, diagnostics, design tokens and reusable UI remain in their dedicated packages.

## Safety boundary

Every runtime mutation must verify the current physical identity and exact owner. Destructive/recovery operations use OFF-first cleanup. Failed or unreadable inventory/mode state is never treated as permission to control the relay.

See `docs/architecture/refactor-boundaries.md` for code boundaries and `docs/architecture/runtime-control.md` for the climate mode/discovery protocol.
''', encoding='utf-8')

Path('docs/product/next-functional-steps.md').write_text('''# Product roadmap

Updated: 2026-09-14

## Immediate priority — restore accepted UX quality

The device/rule decoupling architecture is implemented and verified, but its visual integration regressed parts of the previously accepted v2.0.10 UX. The next product pass is therefore **UX restoration, not a new feature phase**.

Use the physical old-UX reference committed on `main` under `artifacts/ux-reference/main-20260914/`. Preserve all useful behavior introduced by the refactor while restoring the calmer visual hierarchy, compact cards, three-dot detail entry, telemetry presentation, spacing, typography, modals/progressive disclosure and setup flow quality from the reference.

Do not roll back independent Plug / Thermometer / Rule registries or runtime-safety work merely to reproduce a screenshot.

### Acceptance order

1. Rules/dashboard cards and detail/menu behavior.
2. Plug management card, telemetry, ownership state and add/scan flow.
3. Thermometer card, readings/identity and rule-usage information.
4. Climate and time rule editors, including compact weekday row and HH/MM wheel picker.
5. Settings, setup modals and developer diagnostics.
6. Responsive E2E, `pnpm check:full`, then physical Samsung acceptance.

## After UX acceptance

Re-audit the roadmap from the finished product. The strongest previously identified next capability is expanded Shelly `PLUGS_UI` LED configuration using the existing typed client, without adding LED behavior to the climate runtime. Do not start that feature until the current UX restoration is accepted.

## Product invariants

- automation remains local/offline after setup,
- Shelly is the runtime controller; the phone is setup/status/management,
- one relay has one clear automation owner,
- prefer native Shelly capabilities for non-climate functions,
- keep the generated climate script small and safety-focused,
- advanced/developer information stays accessible but should not dominate normal UX.
''', encoding='utf-8')

Path('docs/troubleshooting/mvp.md').write_text('''# Troubleshooting

This document describes the current independent-device/rule architecture. Historical setup-draft and installed-automation recovery paths are intentionally omitted.

## Shelly cannot be registered or reached

Check the saved endpoint, local Wi-Fi connectivity, `Shelly.GetDeviceInfo`, model/identity match, firmware, Scripts availability, BLE capability and Matter state. LAN scan results are candidates only after device-info verification; manual address entry remains available.

Never treat a reachable IP as the device identity. Runtime mutations re-verify the physical Shelly identity before writing.

## Sensor visible on phone but not from Shelly

Check Shelly Bluetooth, sensor battery/distance, runtime BLE address/profile, RSSI threshold and advertising format. Use Shelly-side BLE discovery from the target plug.

### Shelly-side BLE discovery safety

For a deployed climate rule, discovery does **not** use normal script stop/start as a mode switch. The app reads the exact current `R.m` mode, puts the running climate runtime into MANUAL, verifies relay OFF, runs the temporary discovery scanner, cleans it up, restarts climate BLE scanning as needed, and restores the exact previous AUTO/MANUAL mode.

If the previous mode is unknown or restoration cannot be verified, fail closed and keep the relay OFF. Never guess AUTO. A climate script that was genuinely stopped before discovery remains a separate maintenance/recovery state.

## AUTO / MANUAL or manual relay control unavailable

- AUTO and MANUAL require exact managed-script ownership and readable runtime mode.
- MANUAL keeps runtime/diagnostics alive and blocks automatic relay decisions.
- Manual ON/OFF is exposed only for a verified MANUAL climate owner, or as guarded standalone plug control when no rule owns the relay.
- Unknown mode, conflicting ownership or unreadable inventory fails closed.

Normal AUTO/MANUAL changes never call `Script.Stop`/`Script.Start`.

## Climate deployment failed

Upload alone is not deployment success. Verify the current plug identity, exact script id/hash, MANUAL/OFF safety state and safety test. If persistence/attachment fails after a remote mutation, recovery must leave truthful local deployment state and best-effort clean the new remote artifact.

## Time rule failed

Time rules use native Shelly Schedule jobs. Check exact stored job ids and live ownership before edit/pause/resume/delete. Do not create a native time rule that competes with a climate rule for the same relay. Climate active hours are not native schedule ownership.

## Relay state is uncertain

Use OFF-first recovery. Send OFF, reread and verify. If OFF cannot be confirmed, report the uncertainty and do not continue with destructive/redeploy operations as if the relay were safe.

## Sensor stale / weak signal

Check battery, distance, runtime address/profile, packet freshness and RSSI. Incomplete BLE frames may update telemetry without refreshing the control measurement. Do not relax stale/RSSI safety thresholds merely to hide a real radio problem.

## Matter / Scripts / memory problems

Matter or firmware configuration may block Shelly Scripts. `Script.List` availability is a stronger capability signal than assuming a global script field exists in status. For `out_of_memory` / `out_of_codespace`, inspect exact script status and firmware, remove only owned temporary resources, and keep final relay OFF.

For detailed runtime-mode semantics see `docs/architecture/runtime-control.md`. Hardware history and firmware evidence live in `docs/testing/hardware-matrix.md`.
''', encoding='utf-8')

# Keep one short historical MVP design context file but mark it explicitly non-canonical.
plan = Path('docs/plan.md')
if plan.exists():
    original = plan.read_text(encoding='utf-8')
    marker = '> Historical design context only. For current work use `docs/HANDOFF_NEXT_CHAT.md` and `docs/architecture/overview.md`.\n\n'
    if not original.startswith('# Historical'):
        plan.write_text('# Historical MVP plan\n\n' + marker + original, encoding='utf-8')
PY

# Update one stale discovery checklist phrase without rewriting historical evidence.
python3 - <<'PY'
from pathlib import Path
p=Path('docs/testing/hardware-matrix.md')
text=p.read_text(encoding='utf-8')
text=text.replace('scanner deleted, automation resumes', 'scanner cleaned up, exact prior runtime mode restored')
p.write_text(text, encoding='utf-8')
PY

pnpm exec prettier --write \
  docs/HANDOFF_NEXT_CHAT.md \
  docs/architecture/overview.md \
  docs/product/next-functional-steps.md \
  docs/troubleshooting/mvp.md \
  docs/plan.md \
  docs/testing/hardware-matrix.md

# Report any references to removed historical prompt/plan-progress docs; they must not remain.
if rg -n 'device-rule-decoupling-(astra-prompt|plan|progress)|docs/prompts/|ux-polish-backlog' README.md AGENTS.md docs --glob '*.md'; then
  echo 'STALE_DOC_REFERENCES=yes'
  exit 7
fi

git status --short
git add -A
git commit --no-verify -m "Prepare clean UX restoration handoff"
git push --no-verify origin "$WORK_BRANCH"
WORK_FINAL=$(git rev-parse HEAD)
REMOTE_WORK=$(git ls-remote origin "refs/heads/$WORK_BRANCH" | awk '{print $1}')
[ "$WORK_FINAL" = "$REMOTE_WORK" ] || { echo "Work push mismatch"; exit 8; }

echo "MAIN_REFERENCE_HEAD=$MAIN_REF_HEAD"
echo "SCREENSHOT_COUNT=$COUNT"
echo "WORK_PRODUCT_BASE=$WORK_BASE"
echo "WORK_HANDOFF_HEAD=$WORK_FINAL"
echo "HANDOFF=docs/HANDOFF_NEXT_CHAT.md"
