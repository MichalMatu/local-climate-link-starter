#!/usr/bin/env sh
set -eu

BASE=c6a7128eba590f2b711d5d4fe32d74cc2aa8ac2a
BRANCH=work/docs-roadmap-cleanup-fix-20260911

git fetch --prune origin
test "$(git rev-parse origin/main)" = "$BASE"
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
git checkout -B "$BRANCH" "$BASE" >/dev/null
test -z "$(git status --porcelain)"

python3 - <<'PY'
from pathlib import Path
p = Path('docs/product/next-functional-steps.md')
s = p.read_text()
replacements = {
    '## Product direction## Product direction': '## Product direction',
    '### Button — hardware validation complete### Button — hardware validation complete': '### Button — hardware validation complete',
    '## Main risks caught before implementation## Main risks caught before implementation': '## Main risks caught before implementation',
    '### 5. Physical button is intentionally native-only on Plug S Gen3### 5. Physical button is intentionally native-only on Plug S Gen3': '### 5. Physical button is intentionally native-only on Plug S Gen3',
}
for old, new in replacements.items():
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'expected exactly one duplicated heading: {old!r}, got {count}')
    s = s.replace(old, new, 1)
p.write_text(s)
PY

pnpm exec prettier --write docs/product/next-functional-steps.md

git diff --check
pnpm format:check
pnpm quality:repo

if grep -nE 'Product direction##|complete###|implementation##|Gen3###' docs/product/next-functional-steps.md; then
  echo 'duplicate heading artifact remains' >&2
  exit 21
fi

git add docs/product/next-functional-steps.md
git commit -m 'docs: fix roadmap section headings'
git push -u origin "$BRANCH"

echo ROADMAP_HEADING_FIX_SHA=$(git rev-parse HEAD)
echo ROADMAP_HEADING_FIX_OK=1
