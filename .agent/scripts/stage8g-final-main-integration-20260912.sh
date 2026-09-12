#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
OLD_MAIN='885f2ed99bf818da0b38785e9d794dd5e4df8994'
PREMERGE_HEAD='e0a351732d6b361a6728789dd6b51de75549e094'
APP_SHA='8173f0851adc77222fc3e98b02113ff28f7119fd'
STABLE_TAG='stable-20260912-v2.0.10-ux-polish'

# Bind to the exact reviewed refs before touching main.
git fetch --prune origin main "$BRANCH" agent-control --tags
test "$(git rev-parse origin/main)" = "$OLD_MAIN"
test "$(git rev-parse origin/$BRANCH)" = "$PREMERGE_HEAD"
test "$(git rev-parse "$STABLE_TAG^{commit}")" = "$APP_SHA"
git merge-base --is-ancestor "$OLD_MAIN" "$PREMERGE_HEAD"

git reset --hard
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$PREMERGE_HEAD"
test -z "$(git status --porcelain)"

# Convert the canonical docs from pre-merge wording to the post-merge repository state.
python3 - <<'PY'
from pathlib import Path

handoff = Path('docs/HANDOFF_NEXT_CHAT.md')
s = handoff.read_text()
old = "`main` intentionally remains the previously accepted safe baseline until the user explicitly requests a merge/fast-forward. Do not merge this work branch into `main` implicitly."
new = "`main` now contains the completed v2.0.10 UX/architecture cleanup. The stable tag above remains the immutable rollback point for the exact user-accepted application build, while later documentation-only commits may sit above it on `main`."
if s.count(old) != 1:
    raise SystemExit(f'handoff pre-merge sentence count={s.count(old)}')
s = s.replace(old, new, 1)
old_block = """## Branch state after cleanup\n\nKeep:\n\n- `main` — safe baseline; unchanged by this cleanup,\n- `work/ux-polish-20260911` — completed v2.0.10 UX/architecture work and current documentation,\n- `agent-control` — Local Agent control/evidence branch.\n\nThe old Stage 1/checkpoint branches from this pass are obsolete because they are strict ancestors of the completed work branch and are removed during final cleanup.\n"""
new_block = """## Branch state after cleanup\n\nKeep:\n\n- `main` — integrated v2.0.10 UX/architecture baseline and canonical product branch,\n- `agent-control` — Local Agent control/evidence branch.\n\nThe completed `work/ux-polish-20260911` branch and the older Stage 1/checkpoint branches are obsolete after the fast-forward and are removed. Start future product work from the current `main` on a new task-specific branch.\n"""
if s.count(old_block) != 1:
    raise SystemExit(f'handoff branch block count={s.count(old_block)}')
handoff.write_text(s.replace(old_block, new_block, 1))

roadmap = Path('docs/product/next-functional-steps.md')
r = roadmap.read_text()
old = "`main` remains intentionally untouched until the user explicitly requests integration; the stable tag above preserves the accepted application tree independently of later documentation-only commits."
new = "`main` contains this completed baseline. The stable tag above preserves the exact user-accepted application tree independently of later documentation-only commits on `main`."
if r.count(old) != 1:
    raise SystemExit(f'roadmap pre-merge sentence count={r.count(old)}')
roadmap.write_text(r.replace(old, new, 1))
PY

pnpm exec prettier --write docs/HANDOFF_NEXT_CHAT.md docs/product/next-functional-steps.md
pnpm exec prettier --check docs/HANDOFF_NEXT_CHAT.md docs/product/next-functional-steps.md

# Final comprehensive gate on the exact commit that will become main.
pnpm check:full
git diff --check

git add docs/HANDOFF_NEXT_CHAT.md docs/product/next-functional-steps.md
git commit -m 'Finalize v2.0.10 integration documentation'
FINAL_HEAD="$(git rev-parse HEAD)"
test "$(git rev-parse HEAD^)" = "$PREMERGE_HEAD"
git push origin HEAD:"$BRANCH"

git fetch --prune origin main "$BRANCH" --tags
test "$(git rev-parse origin/main)" = "$OLD_MAIN"
test "$(git rev-parse origin/$BRANCH)" = "$FINAL_HEAD"
test "$(git rev-parse "$STABLE_TAG^{commit}")" = "$APP_SHA"
git merge-base --is-ancestor "$OLD_MAIN" "$FINAL_HEAD"

# Fast-forward the canonical branch to the fully checked final head.
git push origin "$FINAL_HEAD":refs/heads/main
git fetch --prune origin main "$BRANCH"
test "$(git rev-parse origin/main)" = "$FINAL_HEAD"
test "$(git rev-parse origin/main^{tree})" = "$(git rev-parse "$FINAL_HEAD^{tree}")"

# The work branch is now redundant; remove it only after main is verified.
test "$(git rev-parse origin/$BRANCH)" = "$FINAL_HEAD"
git push origin --delete "$BRANCH"
git fetch --prune origin

# Repository closure checks.
test "$(git rev-parse origin/main)" = "$FINAL_HEAD"
test "$(git rev-parse "$STABLE_TAG^{commit}")" = "$APP_SHA"
if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  echo 'work branch still exists after cleanup' >&2
  exit 1
fi
REMOTE_HEADS="$(git ls-remote --heads origin | awk '{sub("refs/heads/", "", $2); print $2}' | sort)"
EXPECTED_HEADS="$(printf '%s\n' agent-control main | sort)"
test "$REMOTE_HEADS" = "$EXPECTED_HEADS"
test -z "$(git status --porcelain)"

echo FINAL_APP_SHA="$APP_SHA"
echo FINAL_STABLE_TAG="$STABLE_TAG"
echo FINAL_MAIN_SHA="$FINAL_HEAD"
echo FINAL_MAIN_PARENT="$PREMERGE_HEAD"
echo FINAL_MAIN_FAST_FORWARD=1
echo FINAL_CHECK_FULL=1
echo FINAL_WORK_BRANCH_DELETED=1
echo FINAL_REMOTE_HEADS="$(printf '%s' "$REMOTE_HEADS" | tr '\n' ',')"
