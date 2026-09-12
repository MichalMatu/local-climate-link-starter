#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
BASE='f20863ddfa60a6c1240ad06119528e2728b7129f'

git fetch --prune origin "$BRANCH" agent-control
git reset --hard
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

python3 - <<'PY'
from pathlib import Path
p = Path('scripts/quality/repository-gate.mjs')
s = p.read_text()
old = """  if (orchestratorLines > 1150) {
    addFailure(
      orchestratorPath,
      `hardware setup orchestrator exceeds 1150 lines (${orchestratorLines}); extract a cohesive subsystem instead of growing the god-flow`
    );
  }
"""
new = """  const orchestratorBudget = 650;
  if (orchestratorLines > orchestratorBudget) {
    addFailure(
      orchestratorPath,
      `hardware setup orchestrator exceeds ${orchestratorBudget} lines (${orchestratorLines}); extract a cohesive subsystem instead of growing the god-flow`
    );
  }
"""
assert old in s
s = s.replace(old, new, 1)
marker = """  const pageContracts = {
"""
insert = """  const compositionBudgets = {
    'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx': 700,
    'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx': 650,
    'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx': 675,
    'apps/mobile/src/screens/hardware-setup/pages/useShellySetupFeedback.ts': 200,
    'apps/mobile/src/screens/hardware-setup/pages/useSensorSetupFeedback.ts': 200,
    'apps/mobile/src/screens/hardware-setup/pages/useRuleSetupFeedback.ts': 180,
    'apps/mobile/src/screens/hardware-setup/pages/RuleAdvancedSettingsModal.tsx': 220,
    'apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.ts': 350,
    'apps/mobile/src/flows/hardware-setup/useHardwareDiagnosticsFlow.ts': 350,
    'apps/mobile/src/flows/hardware-setup/useClimateAutomationInstallFlow.ts': 350
  };
  for (const [path, maxLines] of Object.entries(compositionBudgets)) {
    const source = await readRepoFile(path);
    const lines = source.split('\\n').length;
    if (lines > maxLines) {
      addFailure(
        path,
        `hardware setup responsibility boundary exceeds ${maxLines} lines (${lines}); keep the extracted responsibility cohesive instead of regrowing a god object`
      );
    }
  }

"""
assert marker in s
s = s.replace(marker, insert + marker, 1)
p.write_text(s)
PY

cat > docs/architecture/refactor-boundaries.md <<'EOF'
# Refactor boundaries

This document records the responsibility boundaries established during the v2.0.10
architecture and code-cleanliness audit. File size is a warning signal, not a
refactor goal by itself. A file should be split only when it owns more than one
cohesive responsibility or when its public surface is becoming difficult to reason
about and test.

## Hardware setup outcome

The hardware setup façade remains `flows/hardware-setup/useHardwareSetupFlow.ts`,
but it is now a composer rather than the implementation home for every hardware
operation. It is roughly 575 lines, down from more than 1000 lines at the start of
this cleanup and from about 1660 lines in the earlier audit history.

Cohesive capabilities now own their implementation details:

- `ruleConfigDerivation.ts` derives validated Shelly, sensor and climate-rule state.
- `useShellySetupScanFlow.ts` owns LAN scan state, cancellation and scan execution.
- `useHardwareDiagnosticsFlow.ts` owns script diagnostics and resource snapshots.
- `useClimateAutomationInstallFlow.ts` owns install/conflict handling and the safe
  relay test.
- `useShellyControlFlow.ts`, `useShellyBleDiscoveryFlow.ts` and
  `usePhoneSensorFlow.ts` remain the transport/device lifecycle boundaries.

The façade may coordinate these capabilities and expose the compatibility surface
needed by narrow page contracts, but low-level transport, scan, diagnostic,
installation or BLE implementation must not migrate back into it.

## Setup page composition

The largest setup pages were reduced without changing their page contracts:

- `ShellySetupPage.tsx` is about 658 lines; presentation lives in
  `ShellySetupPresentation.tsx` and lifecycle/feedback orchestration in
  `useShellySetupFeedback.ts`.
- `SensorSetupPage.tsx` is about 604 lines; BLE/live-reading lifecycle and transient
  feedback live in `useSensorSetupFeedback.ts`.
- `RuleSetupPage.tsx` is about 638 lines; mutation feedback lives in
  `useRuleSetupFeedback.ts` and advanced settings rendering lives in
  `RuleAdvancedSettingsModal.tsx`.

These parent pages still own page-level composition, local dialog intent and user
interaction wiring. Extracted helpers/hooks own one named responsibility and must
not become generic dumping grounds.

## Regression budgets

`pnpm quality:repo` enforces headroom above the current sizes for the hardware
setup façade, the three largest setup pages and their extracted responsibility
modules. These limits are regression alarms, not targets to optimize toward. If a
limit is approached, first inspect responsibility growth; do not mechanically
shuffle lines into arbitrary files just to satisfy the gate.

The same gate keeps screen/client boundaries, domain-package boundaries, narrow
page contracts and existing subsystem budgets intact. `pnpm quality:ux` continues
to enforce the feedback/modal and design-system contracts.

## Safety-sensitive boundaries

Cleanup ordering and exact ownership are architectural behavior, not formatting:

- relay control must retain OFF-first safety semantics,
- climate/time ownership conflicts must be checked before installation,
- temporary Shelly BLE discovery must be cleaned up before managed automation is
  resumed or installed,
- blocking install failures remain modal feedback rather than transient toasts,
- invalid LAN scan input must be validated when starting a scan, not allowed to
  throw during React render.

Structural refactors must preserve these rules and the existing hardware regression
tests.

## What not to split by size alone

Locale dictionaries, focused hardware scripts and large regression/E2E test files
can legitimately be large data- or scenario-oriented files. They are not God
objects merely because their line count is high. Split them only when a concrete
maintenance or responsibility boundary justifies it.

## Audit hygiene

Production code must remain free of accidental `TODO/FIXME/HACK`, `@ts-ignore`,
broad `eslint-disable`, debug `console.log/debug` and unnecessary `as any` escape
hatches. Architecture cleanup is accepted only when formatting, lint, repository
and UX quality gates, typecheck, tests, coverage, build and responsive E2E remain
green.

## Climate runtime control boundary

AUTO/MANUAL is an in-process runtime state. Keep transport, status interpretation,
relay safety, upgrade/recovery and React synchronization in the dedicated modules
documented in `runtime-control.md`; do not fold them into
`useHardwareSetupFlow`, Dashboard or Installation Detail.
EOF

pnpm exec prettier --write \
  scripts/quality/repository-gate.mjs \
  docs/architecture/refactor-boundaries.md

pnpm check
LCL_E2E_PORT=5197 pnpm e2e:responsive

git diff --check

for path in \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx; do
  echo "ARCH_LINES $(wc -l < "$path" | tr -d ' ') $path"
done

git add scripts/quality/repository-gate.mjs docs/architecture/refactor-boundaries.md
git commit -m 'Harden hardware setup architecture boundaries'
git push origin HEAD:"$BRANCH"

echo STAGE8D1_SHA=$(git rev-parse HEAD)
echo STAGE8D1_PARENT=$(git rev-parse HEAD^)
echo STAGE8D1_CHECK=1
echo STAGE8D1_E2E=1
test -z "$(git status --porcelain)"
