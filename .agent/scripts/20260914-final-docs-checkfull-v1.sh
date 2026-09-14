#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=06da99e9dcc72c0e66d12269cd6605b4536e4c7c
cd "$REPO"

git fetch origin "$BRANCH" agent-control
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
[[ "$(git rev-parse HEAD)" == "$EXPECTED" ]] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

cat > docs/implementation/device-rule-decoupling-progress.md <<'EOF'
# Device/rule decoupling progress

Branch: `work/device-rule-decoupling-20260913`. Do not merge to `main` before final device acceptance.

## Current checkpoint

The product cutover is complete. Plugs, thermometers and rules are independent durable entities and the active product/runtime path no longer depends on `InstalledAutomation`, installation snapshots or the legacy hardware-setup draft store.

Checkpoint entering this documentation refresh: `06da99e9dcc72c0e66d12269cd6605b4536e4c7c`.

## Current architecture

- `flows/devices/plugs` owns saved plugs, registration, standalone runtime inspection and guarded direct relay operations.
- `flows/devices/sensors` owns saved thermometers and live sensor-management orchestration. A saved sensor is global and is never owned by a plug.
- `flows/rules` owns desired climate/time rules, deployment state, lifecycle transactions, runtime ownership and presentation-independent editor state.
- `flows/registry/devicesAndRules.ts` exposes the independent Plug, Sensor and Rule registries.
- Durable sensor-to-plug association exists only through a climate rule.
- Exactly one rule may own a `(plugId, relayId)` pair.
- The product navigation is `Rules / Plugs / Thermometers / Settings`; rule screens route by `ruleId`.
- Rule names and device names are independent. Renaming either side does not mutate the other identity.

## Runtime and safety invariants

- Plug mutations and rule lifecycle work are serialized per physical plug.
- Raw relay control is available only when ownership is known and unclaimed.
- Climate AUTO/MANUAL is the canonical in-process `R.m` state; normal mode changes do not use `Script.Stop`/`Script.Start`.
- Unknown or unreadable climate mode fails closed.
- Climate deployment is not considered safe after upload alone: exact script identity/hash, MANUAL/OFF state and the safety test must be verified before AUTO can resume.
- BLE discovery preserves the exact prior AUTO/MANUAL state and restores it only after scanner cleanup; unknown prior mode rejects instead of guessing.
- Time rules use native Shelly schedules; climate active hours stay inside the climate runtime and do not create native schedule ownership.
- Delete/redeploy/recovery operations verify exact ownership and use OFF-first cleanup semantics.

## Legacy removal completed

The coordinated cleanup removed the old installation product/runtime path, legacy installation detail screens, the hardware setup orchestrator, the old time-automation module, obsolete LED/install E2E, and the persisted hardware setup draft store. Only narrow transient device contracts needed by surviving discovery/diagnostic flows remain in `flows/hardware-setup/draftDevices.ts`.

The registry persistence test intentionally seeds old storage keys and proves that current registries do not read them. This is a negative isolation test, not a compatibility reader.

## Verification completed so far

- Rule/device registry, ownership, lifecycle and fail-closed runtime tests pass.
- Mobile test suite at the setup-draft removal checkpoint: 31 files / 156 tests passed.
- Responsive E2E was rewritten for the current product and passes 7/7 across 360x800, 390x844, 412x915, 768x1024 and 1440x900 coverage.
- Workspace lint, repository/UX quality gates, typecheck, tests, coverage and builds pass through `pnpm check` on the current candidate.
- Earlier real-device service/runtime smokes on Shelly Plug S Gen3 firmware 1.7.5 exercised relay ON/OFF and AUTO/MANUAL discovery restoration and finished with the relay explicitly OFF.

## Remaining acceptance work

1. Run `pnpm check:full` on the documentation-refreshed final candidate.
2. Build/sync/install the debug APK on the connected Samsung SM-S906B using the repository Android workflow.
3. Cold-start and visually inspect Rules, Plugs, Thermometers, Settings, climate/time editors and rule details on the physical phone; capture screenshots and fix any real overflow, safe-area, spacing, touch-target or navigation issues found.
4. Run the final available Shelly hardware smoke with the configured local environment, if present. Any relay exercise must end with an explicit verified OFF state.
5. Record the exact final SHA and acceptance evidence. Do not merge to `main` as part of this branch task.
EOF

cat > docs/architecture/refactor-boundaries.md <<'EOF'
# Refactor boundaries

This document records the current product boundaries after the device/rule decoupling work. File size is a warning signal, not a refactor goal by itself. Split code at a real responsibility boundary and keep screens focused on orchestration and presentation.

## Product model boundary

Plugs, thermometers and rules are independent durable entities.

- Plug persistence and mutations live under `flows/devices/plugs`.
- Sensor persistence and live-management orchestration live under `flows/devices/sensors`.
- Desired rule configuration, deployment metadata, lifecycle transactions and runtime ownership live under `flows/rules`.
- `flows/registry/devicesAndRules.ts` composes the independent registries and supplies cross-registry read boundaries.

A sensor is never plug-owned. Durable plug/sensor association exists only through a climate rule. Rule/device names are independent and mutable without changing the other entity's identity.

## Screen and flow boundary

Screens own route-level composition, dialogs and user interaction. They do not own RPC protocols, persistence transactions or rule deployment algorithms.

- `AutomationDashboardScreen` renders current rules from the Rule registry.
- `RuleDetailScreen` presents runtime state and dispatches lifecycle actions by `ruleId`.
- `RuleEditorScreen` composes the pure rule editor state with `useRuleEditorFlow`.
- `PlugManagementScreen` and `SensorManagementScreen` expose independent device management.
- `AppRoutes` owns the four top-level product sections: Rules, Plugs, Thermometers and Settings.

Flow hooks may orchestrate queries/mutations and narrow UI state, but business transactions remain in focused service/lifecycle modules. Avoid god hooks and large compatibility façades.

## Plug-operation boundary

`flows/devices/plugs/operations.ts` provides the shared per-physical-plug queue. Plug management and rule lifecycle mutations resolve the latest registry state after entering that queue so endpoint changes or ownership changes cannot be bypassed by stale inputs.

Direct relay control is fail closed: inventory must be readable, physical identity must match, and no rule may own the relay. Failed command verification forces OFF and rereads the output.

## Rule lifecycle boundary

`flows/rules/lifecycle.ts` is the product transaction boundary for create/deploy/verify/edit/redeploy/pause/resume/recover/delete and climate manual relay control.

Desired configuration and deployment state remain distinct. A successful remote mutation is not enough when the local deployment attachment fails; recovery must leave a truthful undeployed local state and best-effort remove the new remote artifact.

Exactly one rule may own a `(plugId, relayId)` pair. Product flows must use the live ownership resolver instead of relying on persistence alone.

## Climate runtime boundary

Climate AUTO/MANUAL is an in-process runtime state stored in `R.m`. Normal mode switching keeps the exact managed script running.

- AUTO permits automatic relay decisions.
- MANUAL keeps runtime/diagnostics alive, blocks automatic output and requires OFF before manual control is exposed.
- Unknown/unreadable mode fails closed and is never coerced to AUTO.
- BLE discovery preserves and restores the exact prior mode after cleanup.
- Climate deployment is incomplete until exact script identity/hash and safety state are verified.

Transport/status parsing, runtime ownership and lifecycle transactions stay in their dedicated modules; do not fold them into screen components.

## Time runtime boundary

Time rules own native Shelly Schedule jobs through exact job ids recorded in deployment metadata. Creation, pause/resume, edit/redeploy and deletion are transactional and verify exact schedule ownership.

Climate active-hours constraints are not native time-rule ownership; they remain inside the generated climate runtime.

## Hardware helper boundary

The old persisted hardware-setup draft and setup façade are gone. Surviving `flows/hardware-setup` modules are narrow helpers for discovery, diagnostics, validation and transient device contracts. `draftDevices.ts` contains transient contracts only and must not become a durable store.

No compatibility reader, dual write or adapter may recreate the removed installation/draft persistence path.

## Safety-sensitive boundaries

Structural cleanup must preserve behavior:

- OFF-first relay safety and verified final OFF after destructive/hardware tests,
- exact physical identity before plug mutations,
- exact rule/script/schedule ownership before runtime mutation,
- fail-closed behavior for incomplete or unreadable inventory/mode state,
- cleanup of temporary BLE discovery before restoring climate mode,
- typed persistence/hardware failures visible to the UI rather than inferred from mutation completion.

## Regression gates

`pnpm quality:repo` protects architecture and repository budgets; `pnpm quality:ux` protects feedback/modal/design-system contracts. Final acceptance requires formatting, lint, both quality gates, typecheck, tests, core coverage, build and responsive E2E via `pnpm check:full`.
EOF

cat > docs/HANDOFF_NEXT_CHAT.md <<'EOF'
# Local Climate Link — next chat handoff

Updated: 2026-09-14

This is the canonical continuation handoff for the current device/rule decoupling branch.

## Hard repository binding and execution model

Work only on:

- repository: `MichalMatu/local-climate-link-starter`
- repository id: `local-climate-link-starter`
- Local Agent binding: `e75c77cb-7589-4452-94b2-decc97ff85a1`
- Local Agent control branch: `agent-control`
- managed clone: `/Users/michal/agent-workspace/repos/local-climate-link-starter/work`
- active work branch: `work/device-rule-decoupling-20260913`

Every Local Agent task must contain exactly:

```json
"agent_binding": "e75c77cb-7589-4452-94b2-decc97ff85a1"
```

ChatGPT plans and authors; Local Agent executes deterministic project/tool/device commands. Never launch local Codex or another AI agent from a Local Agent task. Check `.agent/status/daemon.json` before editing the work branch.

Do not merge this work branch to `main` during the acceptance pass.

## Stable rollback baseline

The previously user-accepted v2.0.10 build remains frozen at annotated tag:

```text
stable-20260912-v2.0.10-ux-polish
8173f0851adc77222fc3e98b02113ff28f7119fd
```

Do not move or recreate that tag.

## Current decoupling checkpoint

Checkpoint entering the final documentation/acceptance pass:

```text
06da99e9dcc72c0e66d12269cd6605b4536e4c7c
Remove legacy setup draft store
```

The coordinated product cutover is complete:

- Plugs, Thermometers and Rules are independent registries.
- Rules route and mutate by `ruleId`.
- The dashboard renders Rule registry entries, not installation snapshots.
- Climate and time runtimes use rule-centric lifecycle services.
- Legacy `InstalledAutomation`, installation runtime/store/screens, old time-automation product code, hardware setup orchestrator and persisted `lcl.hardwareSetupDraft.v8` store are removed.
- Responsive E2E now targets the current `Rules / Plugs / Thermometers / Settings` product and passes 7/7.

See `docs/implementation/device-rule-decoupling-progress.md` and `docs/adr/ADR-0006-independent-devices-and-rules.md` for the current model.

## Runtime invariants that must not regress

### Climate AUTO

- exact managed climate script remains running,
- canonical runtime mode is readable and AUTO,
- BLE runtime and diagnostics remain live,
- automatic relay decisions are allowed only for the owning rule.

### Climate MANUAL

- exact managed climate script remains running,
- runtime/diagnostics remain live,
- automatic output decisions are blocked in-process,
- relay is forced/verified OFF before direct manual control is permitted.

### Unknown / stopped / missing

These are failure or maintenance states, not aliases for AUTO or MANUAL. Unknown/unreadable mode fails closed. Normal AUTO/MANUAL switching must not use `Script.Stop`/`Script.Start`.

### Time rules

Native Shelly Schedule jobs are owned by exact ids in rule deployment metadata. Climate active-hours constraints are separate and remain inside the climate script.

## Current architecture boundaries

- `flows/devices/plugs`: plug persistence, registration and guarded standalone runtime operations.
- `flows/devices/sensors`: sensor persistence and live sensor management.
- `flows/rules`: rule model/editor/lifecycle/runtime/ownership.
- `flows/registry/devicesAndRules.ts`: composed independent registries.
- `flows/runtime/relaySafety.ts`: generic OFF-and-confirm safety primitive.
- `flows/hardware-setup`: only surviving narrow discovery/diagnostic/validation helpers and transient `draftDevices.ts` contracts; no durable hardware-draft store.
- Screens orchestrate and present; business transactions remain in flow/service modules.

No compatibility readers, dual writes or adapters should recreate the deleted installation/draft persistence model.

## Current verification state

Before this final acceptance pass:

- `pnpm check` is green on the current implementation candidate.
- mobile tests at the latest cleanup: 31 files / 156 tests passed.
- current responsive Playwright: 7/7 passed across phone, tablet and desktop sizes.
- repository and UX quality gates pass.
- earlier Shelly Plug S Gen3 firmware 1.7.5 service/runtime hardware smokes exercised real ON/OFF and AUTO/MANUAL discovery restoration and explicitly finished relay OFF.

## Exact remaining work

1. Refresh stale architecture/troubleshooting documentation and run `pnpm check:full`.
2. Build/sync/install the candidate APK on Samsung SM-S906B (`RFCT70L7E8J`) using the repository Android workflow.
3. Cold-start and inspect Rules, Plugs, Thermometers, Settings, climate/time editors and rule details on the physical device. Capture screenshots and fix real safe-area, overflow, spacing, touch-target, form/list/detail or navigation problems.
4. Run final hardware smoke if the Shelly environment is available. Real relay ON/OFF is authorized; the last operation must explicitly verify relay OFF.
5. Record final SHA and evidence. Do not merge to `main` automatically.
EOF

python3 - <<'PY'
from pathlib import Path
p = Path('docs/troubleshooting/mvp.md')
s = p.read_text()
old = '''## AUTO / MANUAL controls

`AUTO` and `MANUAL` control the main Shelly automation script named
`Local Climate Link Thermostat`.

```text
AUTO: start the thermostat script. Do not force relay ON.
MANUAL: stop the thermostat script and set relay OFF.
ON/OFF: manually control only the relay.
```

If the app shows `Najpierw zapisz regułę dla tego gniazdka.`, the saved Shelly
does not have the main thermostat script yet. Go to `Reguła`, choose the Shelly
and thermometer, then use `Zapisz i wyślij`.

## Script upload failed

In demo mode, upload uses `FakeShellyClient` and does not contact a real Shelly.
In hardware setup, upload uses local Shelly RPC against the selected saved plug.
'''
new = '''## AUTO / MANUAL controls

`AUTO` and `MANUAL` are the canonical in-process mode of the exact climate rule deployment. The managed Shelly script stays running in both modes; normal mode changes do not use `Script.Stop` or `Script.Start`.

```text
AUTO: allow the owning climate rule to make automatic relay decisions.
MANUAL: block automatic output decisions and force/verify relay OFF.
ON/OFF: manual relay control is available only for a verified MANUAL climate owner.
```

If runtime mode is unknown or unreadable, the app fails closed instead of assuming AUTO. If a climate rule is not deployed or its safety test is not verified, open that rule and complete deployment/verification before attempting normal runtime control.

## Script upload failed

Climate deployment uses local Shelly RPC against the plug referenced by the saved rule. Upload alone is not success: the lifecycle must retain exact script identity/hash, establish MANUAL/OFF state and complete verification before AUTO can resume.
'''
if old not in s:
    raise SystemExit('Expected troubleshooting block not found')
p.write_text(s.replace(old, new))
PY

pnpm exec prettier --write \
  docs/implementation/device-rule-decoupling-progress.md \
  docs/architecture/refactor-boundaries.md \
  docs/HANDOFF_NEXT_CHAT.md \
  docs/troubleshooting/mvp.md

# Product source must stay free of removed legacy runtime/store contracts.
if git grep -nE 'InstalledAutomation|flows/installations|time-automation|setupDraftStore|useHardwareSetupFlow|useClimateAutomationInstallFlow|HardwareSetupScreen|InstallationDetailScreen' -- apps/mobile/src scripts; then
  echo 'Legacy product source reference remains'
  exit 4
fi

# Canonical current docs must not reintroduce deleted architecture claims.
if git grep -nE 'useHardwareSetupFlow|useClimateAutomationInstallFlow|InstalledAutomation remains|production cutover is outstanding|In hardware setup, upload|AUTO: start the thermostat script|MANUAL: stop the thermostat script' -- \
  docs/implementation/device-rule-decoupling-progress.md \
  docs/architecture/refactor-boundaries.md \
  docs/HANDOFF_NEXT_CHAT.md \
  docs/troubleshooting/mvp.md; then
  echo 'Stale canonical documentation remains'
  exit 5
fi

git add \
  docs/implementation/device-rule-decoupling-progress.md \
  docs/architecture/refactor-boundaries.md \
  docs/HANDOFF_NEXT_CHAT.md \
  docs/troubleshooting/mvp.md
pnpm precommit
pnpm check:full

git commit -m "Refresh device rule architecture docs"

git fetch origin "$BRANCH"
[[ "$(git rev-parse origin/$BRANCH)" == "$EXPECTED" ]] || { echo 'Remote branch moved before push'; exit 6; }
git push origin HEAD:"$BRANCH"
git fetch origin "$BRANCH"
FINAL_HEAD=$(git rev-parse HEAD)
[[ "$FINAL_HEAD" == "$(git rev-parse origin/$BRANCH)" ]] || { echo 'Push verification failed'; exit 7; }
echo "FINAL_HEAD=$FINAL_HEAD"
