#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
APP_SHA='8173f0851adc77222fc3e98b02113ff28f7119fd'
MAIN_SHA='885f2ed99bf818da0b38785e9d794dd5e4df8994'
TAG='stable-20260912-v2.0.10-ux-polish'
OLD_BRANCH_1='checkpoint/ux-polish-stage123-20260911'
OLD_BRANCH_2='work/rule-ux-polish-stage1-20260911'

# Start only from the exact user-accepted application build.
git fetch --prune origin "$BRANCH" main agent-control "$OLD_BRANCH_1" "$OLD_BRANCH_2"
git reset --hard
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$APP_SHA"
test "$(git rev-parse origin/main)" = "$MAIN_SHA"
test -z "$(git status --porcelain)"

# Verify obsolete branches are strict ancestors before deleting anything.
git merge-base --is-ancestor "origin/$OLD_BRANCH_1" "$APP_SHA"
git merge-base --is-ancestor "origin/$OLD_BRANCH_2" "$APP_SHA"

# Freeze the exact build that the user physically accepted. Never move an existing tag.
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  test "$(git rev-list -n1 "$TAG")" = "$APP_SHA"
else
  git tag -a "$TAG" "$APP_SHA" -m 'Stable v2.0.10 UX polish baseline verified on Samsung SM-S906B'
  git push origin "refs/tags/$TAG"
fi

cat > docs/HANDOFF_NEXT_CHAT.md <<'EOF'
# Local Climate Link — next chat handoff

Updated: 2026-09-12

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

ChatGPT plans; Local Agent executes deterministic commands/scripts. Never launch local Codex from a Local Agent task. Before editing the work branch, read `.agent/status/daemon.json` and proceed only when repository, binding and task state match.

## Frozen accepted application baseline

The exact application build accepted by the user on the physical Samsung SM-S906B is:

```text
8173f0851adc77222fc3e98b02113ff28f7119fd
Use contextual setup back label
```

It is frozen by the annotated tag:

```text
stable-20260912-v2.0.10-ux-polish
```

Do not move or recreate that tag. It is the rollback point for the completed v2.0.10 UX/architecture cleanup.

`main` intentionally remains the previously accepted safe baseline until the user explicitly requests a merge/fast-forward. Do not merge this work branch into `main` implicitly.

## Completed 2026-09-12 UX and architecture pass

The completed tranche includes:

- compact Shelly and sensor setup surfaces with round `+` add actions,
- climate-only Add automation choices on the Climate dashboard,
- direct Time setup from the Time dashboard without an intermediate intent chooser,
- contextual setup back label: `Zmień cel` for climate flows and `Anuluj` for direct Time setup,
- two-field ON/OFF daily schedule editor with the custom HH/MM wheel picker,
- no raw Shelly URL/IP on the normal schedule surface,
- preserved sensor readings when switching setup tabs; fresh process launch waits for the next BLE advertisement by design,
- render-safe LAN scan input: incomplete IP ranges no longer throw while the user is typing,
- setup feedback/lifecycle orchestration extracted from the largest pages,
- advanced rule settings extracted into a focused modal component,
- `useHardwareSetupFlow.ts` reduced to a composing façade of roughly 575 lines,
- `ShellySetupPage.tsx`, `SensorSetupPage.tsx` and `RuleSetupPage.tsx` reduced to cohesive page composition,
- architecture regression budgets added to `pnpm quality:repo`,
- current architecture documented in `docs/architecture/refactor-boundaries.md`.

No algorithm redesign was included in this pass. The VPD assist keeps its existing behavior and safety semantics.

## Final validation state

Before closure, the exact accepted application SHA passed:

- `pnpm check:full`, including format, lint, UX/repository quality gates, typecheck, all workspace tests, core coverage, build and responsive Playwright,
- responsive Playwright matrix: 25/25,
- production-code hygiene audit for TODO/FIXME/HACK, `@ts-ignore`, unnecessary `as any` and debug console calls,
- relative documentation-link audit,
- physical Android install/cold-start path on Samsung SM-S906B.

The automated final phone script initially stopped because the clean install selected English while the assertion expected Polish text. Build/install succeeded and this was not an application regression. The user then manually verified the final UI flow on the physical phone and confirmed it works.

## Runtime invariants that must not regress

### AUTO

- exact managed climate script remains running,
- BLE runtime and diagnostics remain live,
- automatic relay decisions are allowed.

### MANUAL

- exact managed climate script still remains running,
- BLE/runtime diagnostics remain live,
- automatic output decisions are blocked inside the generated runtime,
- direct phone ON/OFF is allowed only after verified MANUAL ownership/capability.

### STOPPED / MISSING

These are maintenance/failure states, not aliases for MANUAL. Normal AUTO/MANUAL switching must not use `Script.Stop`/`Script.Start`.

## Architecture boundaries

Keep these responsibilities separate:

- `useHardwareSetupFlow.ts` composes narrow hardware capabilities; it must not regain low-level transport, scan, diagnostics or install implementations,
- `useShellySetupScanFlow.ts` owns LAN scan execution and validation timing,
- `useHardwareDiagnosticsFlow.ts` owns diagnostics/resource snapshots,
- `useClimateAutomationInstallFlow.ts` owns install/conflict handling and safe relay testing,
- `useShellyControlFlow.ts`, `useShellyBleDiscoveryFlow.ts` and `usePhoneSensorFlow.ts` remain device lifecycle boundaries,
- setup-page feedback hooks own transient lifecycle/toast/error orchestration,
- page components own page-level composition and user intent, not transport implementation.

Line-count budgets in `scripts/quality/repository-gate.mjs` are regression alarms, not refactor targets. Split code only at a real responsibility boundary.

## Branch state after cleanup

Keep:

- `main` — safe baseline; unchanged by this cleanup,
- `work/ux-polish-20260911` — completed v2.0.10 UX/architecture work and current documentation,
- `agent-control` — Local Agent control/evidence branch.

The old Stage 1/checkpoint branches from this pass are obsolete because they are strict ancestors of the completed work branch and are removed during final cleanup.

## Canonical planning documents

Use these roles consistently:

- `docs/HANDOFF_NEXT_CHAT.md` — current continuation state,
- `docs/product/next-functional-steps.md` — active product roadmap,
- `docs/ux-polish-backlog.md` — only remaining/deferred UX follow-ups after the completed pass,
- `docs/plan.md` — historical MVP/design context,
- `docs/architecture/` and `docs/adr/` — current architecture and decisions,
- `docs/implementation/` — durable implementation contracts/history.

Do not create another continuation/TODO document unless one of these roles genuinely cannot hold the information.

## Next product work

No new product slice is started by this closure. The current roadmap still identifies expanded Shelly LED configuration through the existing `PLUGS_UI` client as the next candidate vertical slice. Re-audit that scope before implementation and keep it app/device-native; do not add LED ownership to the generated climate script.

## Change philosophy

- evidence-driven,
- small, clean, low-risk/high-gain changes,
- no god objects,
- no duplicate state/RPC paths,
- preserve runtime safety semantics,
- prefer device-native Shelly features,
- keep normal user UI calm and diagnostics progressively disclosed.
EOF

python3 - <<'PY'
from pathlib import Path
p = Path('docs/product/next-functional-steps.md')
s = p.read_text()
s = s.replace(
"Status: active product roadmap after the v2.0.10 runtime/detail/diagnostics tranche.\n\nCurrent behavior-changing baseline pending final merge:\n\n```text\n2f42db968fa241c0d904d549befeaad249f48e18\nrefactor(mobile): centralize setup feedback state\n```",
"Status: active product roadmap after the completed v2.0.10 runtime/detail/diagnostics and UX/architecture cleanup tranches.\n\nFrozen user-accepted application baseline:\n\n```text\n8173f0851adc77222fc3e98b02113ff28f7119fd\nUse contextual setup back label\nstable-20260912-v2.0.10-ux-polish\n```"
)
needle = "## Implementation checkpoint — 2026-09-11 / v2.0.10\n"
insert = """## Closure checkpoint — 2026-09-12 / v2.0.10 UX + architecture\n\nThe 2026-09-12 cleanup is completed baseline, not future work. It added contextual Climate/Time setup entry, the custom HH/MM schedule picker, compact device setup surfaces, render-safe LAN scan validation, cohesive feedback/lifecycle hooks, focused install/diagnostic/scan flows, architecture regression budgets, and current architecture documentation. The exact frozen application SHA passed `pnpm check:full` and was manually verified by the user on Samsung SM-S906B.\n\n`main` remains intentionally untouched until the user explicitly requests integration; the stable tag above preserves the accepted application tree independently of later documentation-only commits.\n\n"""
if needle not in s:
    raise SystemExit('roadmap checkpoint heading not found')
s = s.replace(needle, insert + needle, 1)
p.write_text(s)
PY

cat > docs/ux-polish-backlog.md <<'EOF'
# UX polish backlog

Updated: 2026-09-12

The main 2026-09-11/12 UX polish pass is complete. This document now contains only deliberately deferred follow-ups; completed work belongs in the handoff and architecture documentation rather than remaining as an apparent TODO list.

## Completed baseline

The accepted v2.0.10 UX baseline includes compact Shelly/sensor cards, consistent round add actions, climate-scoped intent selection, direct Time setup, custom HH/MM wheel selection, compact rule/VPD presentation, unified modal/toast behavior where justified, and separation of setup feedback/lifecycle orchestration from the largest page components.

The exact accepted application checkpoint is `8173f0851adc77222fc3e98b02113ff28f7119fd`, frozen as `stable-20260912-v2.0.10-ux-polish`.

## Deferred UX follow-ups

- VPD algorithm redesign remains out of scope. Current assist margins remain 0.25 C for temperature and 2 percentage points for humidity until a dedicated runtime/algorithm audit justifies a change.
- Revisit whether VPD target defaults/range should change only together with that algorithm audit; do not alter them as cosmetic cleanup.
- Further Shelly settings restructuring should be driven by a concrete management task, not by file size or a desire to add another settings hierarchy.
- Technical identifiers such as IP/MAC stay available in technical/device-detail views; normal summaries should continue to prefer saved human names.
- BLE scanning should remain inside the existing task/modal flow unless it grows into a genuinely richer workflow such as filtering, multi-select, device details or persistent scan results.
- Do not split large locale dictionaries, focused hardware scripts or scenario-heavy tests merely to reduce line counts.

## Guardrails

- Preserve useful data unless it is genuinely duplicated.
- Keep transient progress inside the active task surface; use global toasts for completion, warning/error or information that remains relevant after the task closes.
- Avoid nested modals for one logical task.
- Preserve runtime/safety behavior during visual cleanup.
- Prefer small isolated changes with focused checks.
- Treat architecture line budgets as regression alarms, not goals.
EOF

pnpm exec prettier --write docs/HANDOFF_NEXT_CHAT.md docs/product/next-functional-steps.md docs/ux-polish-backlog.md

# Final documentation-link audit.
python3 - <<'PY'
from pathlib import Path
import re
from urllib.parse import unquote
broken=[]
checked=0
for doc in Path('docs').rglob('*.md'):
    text=doc.read_text(errors='replace')
    for match in re.finditer(r'(?<!!)\[[^\]]+\]\(([^)]+)\)', text):
        raw=match.group(1).strip().split()[0].strip('<>')
        if not raw or raw.startswith(('#','http://','https://','mailto:','tel:')):
            continue
        target=unquote(raw.split('#',1)[0].split('?',1)[0])
        if not target:
            continue
        checked += 1
        if not (doc.parent / target).resolve().exists():
            line=text.count('\n',0,match.start())+1
            broken.append(f'{doc}:{line}: {raw}')
print(f'FINAL_DOC_LINKS_CHECKED={checked}')
if broken:
    print('\n'.join(broken))
    raise SystemExit(1)
print('FINAL_DOC_LINKS=1')
PY

# Full repository verification one last time.
pnpm check:full
git diff --check

git add docs/HANDOFF_NEXT_CHAT.md docs/product/next-functional-steps.md docs/ux-polish-backlog.md
git commit -m 'Finalize v2.0.10 UX cleanup documentation'
FINAL_DOCS_SHA="$(git rev-parse HEAD)"
git push origin HEAD:"$BRANCH"

# Remove only branches already proven to be ancestors of the frozen accepted app SHA.
git push origin --delete "$OLD_BRANCH_1" "$OLD_BRANCH_2"
git fetch --prune origin
for local_branch in "$OLD_BRANCH_1" "$OLD_BRANCH_2"; do
  if git show-ref --verify --quiet "refs/heads/$local_branch"; then
    git branch -D "$local_branch"
  fi
done

# Final invariants: main unchanged, work branch clean, tag immovable, obsolete remotes gone.
test "$(git rev-parse origin/main)" = "$MAIN_SHA"
test "$(git rev-list -n1 "$TAG")" = "$APP_SHA"
test "$(git rev-parse origin/$BRANCH)" = "$FINAL_DOCS_SHA"
! git ls-remote --exit-code --heads origin "$OLD_BRANCH_1" >/dev/null 2>&1
! git ls-remote --exit-code --heads origin "$OLD_BRANCH_2" >/dev/null 2>&1
test -z "$(git status --porcelain)"

printf 'FINAL_APP_SHA=%s\n' "$APP_SHA"
printf 'FINAL_STABLE_TAG=%s\n' "$TAG"
printf 'FINAL_DOCS_SHA=%s\n' "$FINAL_DOCS_SHA"
printf 'FINAL_MAIN_SHA=%s\n' "$MAIN_SHA"
printf 'DELETED_BRANCH=%s\n' "$OLD_BRANCH_1"
printf 'DELETED_BRANCH=%s\n' "$OLD_BRANCH_2"
echo FINAL_CHECK_FULL=1
echo FINAL_CLEANUP=1
