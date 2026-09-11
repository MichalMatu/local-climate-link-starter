#!/usr/bin/env sh
set -eu

BRANCH=work/production-readiness-hardening-20260911
EXPECTED=2f42db968fa241c0d904d549befeaad249f48e18

git fetch --prune origin main "$BRANCH" >/dev/null
test "$(git rev-parse origin/main)" = "cfe916a19d798d0b5a216b97f726da7bcc02d3ee"
test "$(git rev-parse "origin/$BRANCH")" = "$EXPECTED"
git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null
test -z "$(git status --porcelain)"

python3 - <<'PY'
from pathlib import Path

p = Path('docs/HANDOFF_NEXT_CHAT.md')
s = p.read_text()
repls = [
("""Latest behavior-changing implementation checkpoint pending final merge:

```text
8012d21e57d27f07b070f3e64b3432eb7b4abe2e
refactor(mobile): unify navigation and setup UX
```""",
"""Latest behavior-changing implementation checkpoint pending final merge:

```text
2f42db968fa241c0d904d549befeaad249f48e18
refactor(mobile): centralize setup feedback state
```"""),
("Remote branch cleanup state at this checkpoint: product work branches are gone; only `main`, `agent-control`, and the short-lived documentation cleanup branch created for this update are expected. No open pull requests were present before this cleanup.",
 "Remote branch cleanup state at this checkpoint: `work/production-readiness-hardening-20260911` is the only product work branch expected before final fast-forward into `main`; it must be removed after the merge."),
("Physical Samsung S22+ review is the next verification step after final merge/install.",
 "The production-readiness tranche is behavior-preserving for Shelly runtime/safety paths. After final merge, install the exact final `main` build as a release sanity check; no new physical Shelly behavior test is required unless runtime behavior changes."),
]
for old, new in repls:
    if s.count(old) != 1:
        raise SystemExit(f'HANDOFF replacement mismatch: {old[:60]!r} count={s.count(old)}')
    s = s.replace(old, new, 1)
marker = "## Next agreed vertical slice — Shelly LED configuration\n"
section = """## Production-readiness hardening tranche (2026-09-11)

Completed and validated through `2f42db968fa241c0d904d549befeaad249f48e18`:

- removed the dead `DemoWizard`/demo flow, obsolete `manage` setup intent and stale locale copy,
- kept visual tokenization centralized and strengthened UX gates so new mobile CSS cannot silently bypass the token system,
- reduced `useHardwareSetupFlow` from roughly 1656 to 1021 lines by extracting cohesive Shelly control, Shelly-side BLE discovery and phone/sensor BLE subsystems,
- reduced the hardware-setup public surface from roughly 119 to 108 fields and introduced typed per-page `Pick` contracts,
- added repository ratchets that cap orchestrator/public-API growth and prevent pages from depending on the full setup flow,
- replaced independent modal booleans on the largest setup pages with cohesive discriminated dialog state; local `useState` occurrences fell from about 16/8/7 to 4/3/3 for Shelly/Rule/Sensor,
- centralized setup toast queue behavior, including diagnostics,
- kept `packages/script-generator`, `packages/automation-core`, `packages/shelly-client` and installation runtime paths unchanged.

Validation is green: formatting, lint, `quality:ux`, `quality:repo`, typecheck, all workspace tests, core coverage, build and responsive Playwright (**25/25**). Final read-only diff audit also passed with no TODO/FIXME/HACK, eslint disables, TypeScript suppressions, production `any`, or inline JSX styles.

Large setup-page files may still contain substantial declarative JSX; do not split them merely to reduce line counts. Future extraction should follow a concrete responsibility boundary or measurable coupling problem.

"""
if s.count(marker) != 1:
    raise SystemExit('HANDOFF LED marker mismatch')
s = s.replace(marker, section + marker, 1)
p.write_text(s)

p = Path('docs/product/next-functional-steps.md')
s = p.read_text()
old = """Current behavior-changing baseline:

```text
16d8627b9df050152a72f021e2ab3a228cffefb3
feat(mobile): add installation controls and diagnostics
```"""
new = """Current behavior-changing baseline pending final merge:

```text
2f42db968fa241c0d904d549befeaad249f48e18
refactor(mobile): centralize setup feedback state
```"""
if s.count(old) != 1:
    raise SystemExit(f'roadmap baseline mismatch: {s.count(old)}')
s = s.replace(old, new, 1)
s = s.replace('- intent-first entry and installed-automation dashboard,', '- dashboard-first entry; Add automation opens only from the dashboard `+` action,', 1)
old = """## 1. Better UX — start from user intent

Replace the technical top-level mental model:

```text
Shelly -> Sensor -> Rule -> Diagnostics
```

with a task-oriented entry point such as:

```text
What do you want to do?
- control temperature
- control humidity
- manage an existing automation
```

Heating/cooling and humidifying/dehumidifying remain presets inside the relevant
flow rather than primary navigation concepts.

Do not force an already configured user through the setup wizard on every app
launch. New users should enter setup; existing users should land on their
systems/dashboard.

Keep the current working setup operations and adapters. This phase is an
information-architecture and composition change, not a rewrite of BLE, Shelly
RPC, or script generation.

### Re-audit warning

The current setup pages are already large. Avoid replacing them with one new
large wizard component. Extract small presentational steps and keep orchestration
in the flow layer.
"""
new = """## 1. Better UX — completed

The app now uses a dashboard-first information architecture. Existing and new
users land on the normal automation dashboard; the task-oriented setup picker is
opened only from the dashboard `+` action and offers temperature, humidity, and
time automation. Existing automations are managed from their dashboard/detail
surfaces rather than through a duplicate `manage existing automation` setup path.

Heating/cooling and humidifying/dehumidifying remain presets inside the relevant
flow rather than primary navigation concepts. Global `Klimat / Czas / Ustawienia`
navigation remains visible through setup while local setup tabs stay second-level.

The implementation reuses the existing BLE, Shelly RPC and script-generation
adapters. The production-readiness hardening subsequently narrowed setup-page
contracts and extracted cohesive flow subsystems instead of introducing a new
wizard god-component.
"""
if s.count(old) != 1:
    raise SystemExit(f'roadmap phase-1 mismatch: {s.count(old)}')
s = s.replace(old, new, 1)
p.write_text(s)
PY

pnpm exec prettier --write docs/HANDOFF_NEXT_CHAT.md docs/product/next-functional-steps.md
git diff --check
git diff -- docs/HANDOFF_NEXT_CHAT.md docs/product/next-functional-steps.md

git add docs/HANDOFF_NEXT_CHAT.md docs/product/next-functional-steps.md
git commit -m "docs: close production readiness hardening"
git push origin "$BRANCH"
echo "PRODUCTION_READINESS_DOCS_SHA=$(git rev-parse HEAD)"
