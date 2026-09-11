#!/usr/bin/env sh
set -eu
EXPECTED_SHA=cfe916a19d798d0b5a216b97f726da7bcc02d3ee
git fetch --prune origin main >/dev/null
test "$(git rev-parse origin/main)" = "$EXPECTED_SHA"
git checkout -B main origin/main >/dev/null
test -z "$(git status --porcelain)"

python3 - <<'PY'
from pathlib import Path
import re
from collections import Counter, defaultdict
root=Path('.')
mobile=root/'apps/mobile/src'
prod_tsx=[p for p in mobile.rglob('*.tsx') if '__tests__' not in p.parts and not re.search(r'\.(test|spec)\.tsx$', p.name)]
css=[p for p in [mobile/'theme/theme.css', mobile/'screens/AutomationDashboardScreen.css', mobile/'components/AppBottomNavigation.css', root/'packages/ui/src/styles.css'] if p.exists()]

print('=== PRODUCTION TSX COPY / HYGIENE ===')
polish_rx=re.compile(r'[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]')
direct=[]
for p in prod_tsx:
  for i,line in enumerate(p.read_text().splitlines(),1):
    # Ignore translation keys/comments/import paths; report likely runtime copy only.
    if polish_rx.search(line) and not re.search(r"\bt\(['\"]", line):
      direct.append((p,i,line.strip()))
print('PROD_DIRECT_POLISH_CANDIDATES=',len(direct))
for p,i,line in direct[:120]: print(f'{p}:{i}: {line[:180]}')

print('\n=== TOKEN BYPASS REFINEMENT ===')
patterns={
 'numeric-font-weight': re.compile(r'font-weight:\s*(500|600|700|800)\s*;'),
 'raw-radius': re.compile(r'border-radius:\s*(?!var\()[^;]+;'),
 'raw-font-size': re.compile(r'font-size:\s*(?!var\(|calc\()[^;]+;'),
 'raw-gap': re.compile(r'(?<!-)gap:\s*(?!var\(|calc\()[^;]+;'),
 'raw-padding': re.compile(r'padding(?:-[a-z]+)?:\s*(?!var\(|calc\()[^;]+;'),
 'raw-margin': re.compile(r'margin(?:-[a-z]+)?:\s*(?!var\(|calc\()[^;]+;'),
 'raw-min-height': re.compile(r'min-height:\s*(?!var\(|calc\()[^;]+;'),
 'raw-width': re.compile(r'(?<!-)width:\s*(?!var\(|calc\(|min\(|max\()[^;]+;'),
}
for name,rx in patterns.items():
  hits=[]
  for p in css:
    for i,line in enumerate(p.read_text().splitlines(),1):
      if rx.search(line): hits.append((p,i,line.strip()))
  print(f'{name}: {len(hits)}')
  for p,i,line in hits[:60]: print(f'  {p}:{i}: {line}')

print('\n=== GOD FLOW API ===')
flow=(mobile/'flows/hardware-setup/useHardwareSetupFlow.ts').read_text()
start=flow.rfind('\n  return {')
end=flow.find('\n  };',start)
body=flow[start:end] if start!=-1 and end!=-1 else ''
entries=[]
for line in body.splitlines()[1:]:
  s=line.strip().rstrip(',')
  if s and not s.startswith('//') and not s.startswith('return') and not s in {'{','}'}:
    # count only top-level-ish simple return fields
    if re.match(r'^[A-Za-z_$][\w$]*(?::|$)',s): entries.append(s)
print('HARDWARE_SETUP_FLOW_RETURN_FIELDS=',len(entries))
for e in entries: print('  '+e)

print('\n=== PAGE COUPLING TO FLOW ===')
for p in sorted((mobile/'screens/hardware-setup/pages').glob('*.tsx')):
  text=p.read_text()
  fields=sorted(set(re.findall(r'flow\.([A-Za-z_$][\w$]*)',text)))
  print(f'{p}: flow_fields={len(fields)}')
  print('  '+', '.join(fields))

print('\n=== TOP-LEVEL SCREEN REFERENCES ===')
for p in sorted((mobile/'screens').glob('*.tsx')):
  stem=p.stem
  refs=[]
  for q in mobile.rglob('*'):
    if not q.is_file() or q==p or q.suffix not in {'.ts','.tsx'}: continue
    if stem in q.read_text(errors='ignore'): refs.append(str(q))
  print(f'{p}: references={len(refs)}')
  for r in refs[:20]: print('  '+r)

print('\n=== CSS FILE RESPONSIBILITY ===')
for p in css:
  text=p.read_text()
  selectors=sum(1 for line in text.splitlines() if line.strip().endswith('{') and not line.strip().startswith('@'))
  medias=text.count('@media')
  print(f'{p}: lines={len(text.splitlines())} selectors~={selectors} media={medias}')

print('\n=== TOKEN GENERATOR DUPLICATION ===')
gen=(root/'packages/design-tokens/build/build-tokens.mjs').read_text()
print('EXPLICIT_LIGHT_REEMITS_BASE=', "...lightVariableLines," in gen[gen.find(\":root[data-lcl-theme='light']\"):])
print('LIGHT_VARIABLE_LINES_REFS=',gen.count('lightVariableLines'))

print('\n=== QUALITY GATE COVERAGE GAPS ===')
ux=(root/'scripts/quality/ux-gate.mjs').read_text()
repo=(root/'scripts/quality/repository-gate.mjs').read_text()
for label,needle in [
 ('component-size-budget','maxLines'),
 ('flow-return-surface-budget','HardwareSetupFlow'),
 ('numeric-font-weight-token-check','font-weight'),
 ('all-mobile-css-discovery',"listRepoFiles('apps/mobile/src')"),
 ('screen-shell-contract','app-bottom-nav-shell'),
 ('page-header-contract','app-page-header')]:
  source=ux+'\n'+repo
  print(f'{label}={needle in source}')
print('\nPRODUCTION_READINESS_AUDIT_V3_OK=1')
PY
