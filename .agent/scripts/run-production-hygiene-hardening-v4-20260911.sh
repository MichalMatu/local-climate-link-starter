#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-production-hygiene-hardening-v3-20260911.sh > /tmp/production-hygiene-v4-inner.sh
python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/production-hygiene-v4-inner.sh')
s=p.read_text()
old="for p in sorted(Path('apps/mobile/src/app/locales').glob('*.ts')):\n"
new="for name in ['pl.ts','en.ts','de.ts','es.ts','fr.ts','it.ts','ptBr.ts']:\n    p = Path('apps/mobile/src/app/locales') / name\n"
if s.count(old)!=1: raise SystemExit(f'primary locale loop marker mismatch: {s.count(old)}')
s=s.replace(old,new,1)
p.write_text(s)
PY
sh /tmp/production-hygiene-v4-inner.sh
