#!/usr/bin/env sh
set -eu

BASE=16d8627b9df050152a72f021e2ab3a228cffefb3
BRANCH=work/docs-roadmap-cleanup-20260911

git fetch --prune origin
test "$(git rev-parse origin/main)" = "$BASE"
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
git checkout -B "$BRANCH" "$BASE" >/dev/null
test -z "$(git status --porcelain)"

cat > docs/HANDOFF_NEXT_CHAT.md <<'EOF'
# Local Climate Link — next chat handoff

Updated: 2026-09-11

This is the canonical continuation handoff. Read it before changing code.

## Hard repository binding and execution model

Work only on:

- repository: `MichalMatu/local-climate-link-starter`
- repository id: `local-climate-link-starter`
- Local Agent binding: `e75c77cb-7589-4452-94b2-decc97ff85a1`
- Local Agent control branch: `agent-control`
- managed clone: `/Users/michal/agent-workspace/repos/local-climate-link-starter/work`

Every Local Agent task must contain exactly:

```json
"agent_binding": "e75c77cb-7589-4452-94b2-decc97ff85a1"
```

ChatGPT plans; Local Agent executes deterministic commands/scripts. Never launch local Codex from a Local Agent task. Before editing a work branch, read `.agent/status/daemon.json` and proceed only when the repository/binding match and the worker is idle.

## Current product baseline

Last behavior-changing `main` commit before this documentation cleanup:

```text
16d8627b9df050152a72f021e2ab3a228cffefb3
feat(mobile): add installation controls and diagnostics
```

Frozen MANUAL-runtime rollback tag remains:

```text
stable-20260911-manual-runtime
4462a5246e06f7cebcb5808eace2d6278988e56e
```

Remote branch cleanup state at this checkpoint: product work branches are gone; only `main`, `agent-control`, and the short-lived documentation cleanup branch created for this update are expected. No open pull requests were present before this cleanup.

## Completed and accepted product state

The current v2.0.10 line now includes:

- persistent per-installation identity/configuration,
- intent-first entry, dashboard, stable installation detail and shared bottom navigation,
- climate AUTO/MANUAL runtime mode where the managed Shelly script stays running in both modes,
- MANUAL-only direct relay ON/OFF using the verified existing safety path,
- native Shelly schedules for pure time automation,
- current-value climate UI without sensor chart/history persistence,
- installation-scoped diagnostics with runtime/resource, BLE health and Shelly electrical/system telemetry,
- diagnostics auto-refresh every 3 seconds only while the modal is open; background polling is disabled and manual refresh remains available,
- responsive bottom-navigation/toast spacing verified by Playwright,
- native Shelly physical-button behavior preserved as `momentary` with no detached/long-press ownership added by Local Climate Link.

The exact `16d8627b...` Android build was installed on the Samsung S22+ and opened successfully. The user physically reviewed the new installation-detail controls and diagnostics UX and accepted this tranche.

## Runtime invariants that must not regress

### AUTO

- exact managed climate script remains running,
- BLE runtime and `/script/<id>/diag` remain live,
- automatic relay decisions are allowed.

### MANUAL

- exact managed climate script still remains running,
- BLE/runtime diagnostics remain live,
- automatic output decisions are blocked inside the generated runtime,
- direct phone ON/OFF is allowed only after verified MANUAL ownership/capability.

### STOPPED / MISSING

These are maintenance/failure states, not aliases for MANUAL. Normal AUTO/MANUAL switching must not use `Script.Stop`/`Script.Start`.

## Next agreed vertical slice — Shelly LED configuration

This is the next product task unless the user explicitly changes priority.

### Current implementation

`apps/mobile/src/screens/ShellyLedSettingsCard.tsx` already reads `PLUGS_UI` and shows the current LED mode. For `switch` mode it displays relay ON/OFF RGB + brightness; for `power` mode it displays brightness.

`apps/mobile/src/flows/installations/deviceLed.ts` currently exposes only two write presets:

- `relay-state`
- `off`

`packages/shelly-client/src/plugsUi.ts` already validates and writes more than the wrapper exposes:

- modes `power`, `switch`, `off`,
- arbitrary `switch:0` ON RGB + brightness,
- arbitrary `switch:0` OFF RGB + brightness,
- power-mode brightness.

Therefore the next slice should expand the app/device wrapper and UX; it should not create a second RPC client or add LED logic to the generated climate script.

### Target scope

1. Preimplementation audit the existing LED card, `deviceLed.ts`, `plugsUi.ts`, tests and the current Shelly Plug S Gen3 behavior before editing.
2. Add editable LED configuration using the existing `PLUGS_UI.SetConfig` path:
   - LED mode: `switch`, `power`, `off`,
   - relay ON color and brightness in switch mode,
   - relay OFF color and brightness in switch mode,
   - power-mode brightness when that mode is selected.
3. Keep quick presets only if they improve UX; do not let presets become a parallel state model.
4. After every write, re-read the exact Shelly configuration and display the confirmed device state.
5. Keep unsupported/older firmware graceful: read-only unsupported state, no fake defaults and no broken installation detail.
6. Keep the UI compact and consistent with the current installation-detail pattern; avoid another large god component or a second settings system.
7. Add focused Shelly-client validation tests, installation-flow tests, UI tests and responsive E2E coverage.
8. Finish with a real Shelly Plug S Gen3 smoke test and restore a deliberate final LED state.

### Explicit non-goals for the first LED expansion

- no thermostat-script LED ownership,
- no dynamic error flashing based on RSSI/battery/runtime reasons,
- no coupling between LED state and proof that automation is healthy,
- no physical-button behavior changes,
- no speculative night-mode UI unless a separate capability/schema audit explicitly brings it into scope.

## Canonical planning documents

Use these roles consistently:

- `docs/HANDOFF_NEXT_CHAT.md` — current continuation state and the next concrete task,
- `docs/product/next-functional-steps.md` — canonical active product roadmap,
- `docs/plan.md` — historical MVP/design context only,
- `docs/architecture/` and `docs/adr/` — current architecture and decisions,
- `docs/implementation/` — durable implementation contracts/history, not a task backlog.

Do not create another TODO/continue file for LED work; update the two canonical files above instead.

## Validation expectations for the next code slice

At minimum:

```sh
pnpm --filter @lcl/shelly-client test
pnpm --filter @lcl/mobile test
pnpm --filter @lcl/mobile lint
pnpm --filter @lcl/mobile typecheck
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile build
pnpm e2e:responsive
```

Also run `git diff --check`, inspect the final diff before merge, and keep the generated climate script untouched unless the task explicitly changes runtime behavior.

## Change philosophy

- evidence-driven,
- small, clean, low-risk/high-gain changes,
- no god objects,
- no duplicate state/RPC paths,
- preserve the stable runtime safety model,
- prefer device-native Shelly features for device UI such as LED configuration,
- keep user-facing UI calm and service diagnostics progressively disclosed.
EOF

python3 - <<'PY'
from pathlib import Path

p = Path('docs/product/next-functional-steps.md')
s = p.read_text()

def replace_between(text: str, start: str, end: str, replacement: str) -> str:
    a = text.find(start)
    if a < 0:
        raise SystemExit(f'missing start marker: {start}')
    b = text.find(end, a)
    if b < 0:
        raise SystemExit(f'missing end marker: {end}')
    return text[:a] + replacement + text[b:]

prefix = '''# Local Climate Link — post-v2.0.10 product roadmap

Status: active product roadmap after the v2.0.10 runtime/detail/diagnostics tranche.

Current behavior-changing baseline:

```text
16d8627b9df050152a72f021e2ab3a228cffefb3
feat(mobile): add installation controls and diagnostics
```

This document is the canonical roadmap for the next product phase. `docs/plan.md`
remains historical MVP/design context; `docs/HANDOFF_NEXT_CHAT.md` carries the
short current continuation state.

## Implementation checkpoint — 2026-09-11 / v2.0.10

The following slices are implemented baseline, not future work:

- persistent per-installation identity/configuration,
- intent-first entry and installed-automation dashboard,
- stable per-installation detail management,
- shared `Klimat / Czas / Ustawienia` bottom navigation and full-page Settings,
- explicit AUTO/MANUAL plus MANUAL-only relay ON/OFF with exact-script safety checks,
- native Shelly schedule ownership for pure time automation,
- progressive disclosure for installation-scoped developer diagnostics,
- script/device resource diagnostics and 3-second modal-only auto-refresh,
- current-value-only climate UI; chart/history persistence was intentionally removed,
- completed physical-button validation preserving native momentary behavior.

The next agreed product slice is **expanded Shelly LED configuration**. Keep it
app-side through `PLUGS_UI`; do not re-open the stable climate runtime or add LED
logic to the generated thermostat script.

'''
s = replace_between(s, '# Local Climate Link — post-v2.0.9 product roadmap', '## Product direction', prefix + '## Product direction')

led = '''### LED — next vertical slice

Shelly Plug S Gen3 exposes `PLUGS_UI` device configuration. The repository already
has a working typed client and a basic installation-detail card, so this is now an
incremental UX/capability expansion rather than a new subsystem.

Current code state:

- `RpcShellyPlugsUiClient` reads/writes `PLUGS_UI`,
- typed validation already covers modes `power`, `switch`, and `off`,
- typed patches already support arbitrary relay ON/OFF RGB + brightness and
  power-mode brightness,
- `ShellyLedSettingsCard` displays the confirmed current mode/configuration,
- `deviceLed.ts` currently narrows writes to two presets: `relay-state` and `off`.

Next implementation:

1. keep the existing client and query path; do not create a second LED backend,
2. expand the installation-level wrapper from preset-only writes to a typed editable
   configuration,
3. expose mode selection (`switch`, `power`, `off`),
4. in switch mode expose relay ON color + brightness and relay OFF color + brightness,
5. in power mode expose brightness only,
6. re-read `PLUGS_UI.GetConfig` after every write and render the confirmed device state,
7. retain a compact relay-state preset only if it remains a useful shortcut rather than
   becoming a parallel state model,
8. keep unsupported firmware graceful and do not invent fallback values,
9. add focused client/flow/UI tests, responsive E2E coverage, then a real Plug S Gen3
   smoke test.

Keep LED configuration separate from automation health. Do not infer script health from
LED color and do not add dynamic RSSI/battery/error flashing in this slice. Night-mode
configuration is also a separate follow-up unless a dedicated capability/schema audit
explicitly brings it into scope.

'''
s = replace_between(s, '### LED — safe first step', '### Button — hardware validation complete', led + '### Button — hardware validation complete')

order = '''## Implementation order

Completed baseline:

1. persistent per-installation model,
2. intent-first UX shell and navigation,
3. dashboard backed by installed-system/runtime state,
4. per-installation detail screen,
5. progressive disclosure and scoped developer diagnostics,
6. first automation expansion using native Shelly schedules,
7. physical-button hardware validation with native momentary behavior preserved.

Next:

8. expanded Shelly LED configuration through `PLUGS_UI`, using the existing client and
   installation detail without changing the climate runtime.

After LED configuration is stable, re-audit the remaining product roadmap from actual
user/hardware evidence instead of carrying old speculative TODOs forward.

'''
s = replace_between(s, '## Implementation order', '## Main risks caught before implementation', order + '## Main risks caught before implementation')

risk4 = '''### 4. LED capability should stay device-native

The client already supports static `PLUGS_UI` mode/color/brightness configuration; the
current app wrapper is simply narrower than that capability. Expand the UI/wrapper,
not the thermostat runtime. Dynamic error flashes and night-mode behavior remain
separate experiments until explicitly audited and tested on hardware.

'''
s = replace_between(s, '### 4. LED capability is narrower than the original idea', '### 5. Physical button is intentionally native-only on Plug S Gen3', risk4 + '### 5. Physical button is intentionally native-only on Plug S Gen3')

p.write_text(s)
PY

pnpm exec prettier --write docs/HANDOFF_NEXT_CHAT.md docs/product/next-functional-steps.md

git diff --check
pnpm format:check
pnpm quality:repo

echo '=== DOC REFERENCES ==='
grep -n 'Next agreed vertical slice\|Shelly LED configuration\|Canonical planning documents' docs/HANDOFF_NEXT_CHAT.md
grep -n 'next agreed product slice\|LED — next vertical slice\|expanded Shelly LED configuration' docs/product/next-functional-steps.md

echo '=== REMOTE BRANCHES BEFORE COMMIT ==='
git branch -r --format='%(refname:short)' | sort

git add docs/HANDOFF_NEXT_CHAT.md docs/product/next-functional-steps.md
git commit -m 'docs: refresh handoff and LED roadmap'
git push -u origin "$BRANCH"

echo DOCS_CLEANUP_SHA=$(git rev-parse HEAD)
echo DOCS_CLEANUP_BRANCH=$BRANCH
echo DOCS_CLEANUP_OK=1
