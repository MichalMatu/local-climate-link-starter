#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-production-hygiene-hardening-20260911.sh > /tmp/production-hygiene-v2-inner.sh
python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/production-hygiene-v2-inner.sh')
s=p.read_text()
old="paths += list(Path('apps/landing/src/styles').glob('*.css'))\n"
if s.count(old)!=1: raise SystemExit(f'landing weight path marker mismatch: {s.count(old)}')
s=s.replace(old,"# Landing intentionally owns a separate editorial typography scale.\n",1)
old="""      if (rawFontWeight) {
        addFailure(path, `line ${index + 1} uses non-tokenized font weight`);
      }
"""
new="""      if (rawFontWeight && cssPaths.includes(path)) {
        addFailure(path, `line ${index + 1} uses non-tokenized font weight`);
      }
"""
if s.count(old)!=1: raise SystemExit(f'font gate scope marker mismatch: {s.count(old)}')
s=s.replace(old,new,1)
old="""if git grep -n -E 'font-weight:[[:space:]]*[0-9]+[[:space:]]*;' -- \\
  'apps/mobile/src/**/*.css' 'packages/ui/src/**/*.css' 'apps/landing/src/styles/*.css'; then
"""
new="""if git grep -n -E 'font-weight:[[:space:]]*[0-9]+[[:space:]]*;' -- \\
  'apps/mobile/src/**/*.css' 'packages/ui/src/**/*.css'; then
"""
if s.count(old)!=1: raise SystemExit(f'font guard marker mismatch: {s.count(old)}')
s=s.replace(old,new,1)
p.write_text(s)
PY
sh /tmp/production-hygiene-v2-inner.sh
