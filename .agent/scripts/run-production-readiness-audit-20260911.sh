#!/usr/bin/env sh
set -eu

EXPECTED_SHA=cfe916a19d798d0b5a216b97f726da7bcc02d3ee

git fetch --prune origin main >/dev/null
test "$(git rev-parse origin/main)" = "$EXPECTED_SHA"
git checkout -B main origin/main >/dev/null
test "$(git rev-parse HEAD)" = "$EXPECTED_SHA"
test -z "$(git status --porcelain)"

python3 - <<'PY'
from pathlib import Path
import re
from collections import Counter

AUDIT_SHA='cfe916a19d798d0b5a216b97f726da7bcc02d3ee'
root = Path('.')
mobile = root / 'apps/mobile/src'
all_code = [p for p in root.rglob('*') if p.is_file() and p.suffix in {'.ts','.tsx','.css','.js','.mjs','.cjs'} and 'node_modules' not in p.parts and 'dist' not in p.parts and 'build' not in p.parts]
mobile_code = [p for p in mobile.rglob('*') if p.is_file() and p.suffix in {'.ts','.tsx','.css'}]

print('=== BASELINE ===')
print('AUDIT_SHA=' + AUDIT_SHA)
print('CODE_FILES=' + str(len(all_code)))
print('MOBILE_CODE_FILES=' + str(len(mobile_code)))

print('\n=== LARGEST SOURCE FILES ===')
rows=[]
for p in all_code:
    try: text=p.read_text()
    except UnicodeDecodeError: continue
    rows.append((len(text.splitlines()), str(p)))
for n,p in sorted(rows, reverse=True)[:35]:
    print(f'{n:5d} {p}')

print('\n=== MOBILE TS/TSX COMPLEXITY HEURISTICS ===')
for p in sorted([p for p in mobile.rglob('*') if p.suffix in {'.ts','.tsx'}]):
    text=p.read_text()
    lines=len(text.splitlines())
    hooks=sum(text.count(x) for x in ['useState(', 'useEffect(', 'useMemo(', 'useCallback(', 'useQuery(', 'useMutation('])
    callbacks=len(re.findall(r'\b(?:on[A-Z][A-Za-z0-9_]*|handle[A-Z][A-Za-z0-9_]*)\s*=\s*(?:useCallback\()?\s*\(?', text))
    if lines >= 300 or hooks >= 8 or callbacks >= 10:
        print(f'{lines:5d} lines hooks={hooks:2d} handlers={callbacks:2d} {p}')

print('\n=== CODE SMELLS / ESCAPES ===')
checks = {
    'TODO/FIXME/HACK': re.compile(r'\b(?:TODO|FIXME|HACK|XXX)\b'),
    'eslint-disable': re.compile(r'eslint-disable'),
    'ts-ignore/expect-error': re.compile(r'@ts-(?:ignore|expect-error)'),
    'explicit any': re.compile(r'(?<![A-Za-z0-9_])any(?![A-Za-z0-9_])'),
    'console.log/debug': re.compile(r'console\.(?:log|debug)\s*\('),
    'inline style JSX': re.compile(r'\bstyle=\{\{'),
}
for label, rx in checks.items():
    matches=[]
    for p in all_code:
        text=p.read_text(errors='ignore')
        for i,line in enumerate(text.splitlines(),1):
            if rx.search(line):
                matches.append((str(p),i,line.strip()))
    print(f'{label}: {len(matches)}')
    for p,i,line in matches[:20]: print(f'  {p}:{i}: {line[:180]}')

print('\n=== DESIGN TOKEN AUDIT (MOBILE CSS) ===')
css_files=list(mobile.rglob('*.css'))
css='\n'.join(p.read_text() for p in css_files)
print('CSS_FILES=' + str(len(css_files)))
print('LCL_VAR_USES=' + str(css.count('var(--lcl-')))
print('RAW_HEX_COLORS=' + str(len(re.findall(r'#[0-9a-fA-F]{3,8}\b', css))))
print('RAW_RGB_HSL_COLORS=' + str(len(re.findall(r'\b(?:rgb|rgba|hsl|hsla)\(', css))))

visual_props = re.compile(r'^\s*(padding(?:-[a-z]+)?|margin(?:-[a-z]+)?|gap|row-gap|column-gap|font-size|border-radius|box-shadow|color|background(?:-color)?|border(?:-[a-z]+)?(?:-color|-width)?|width|height|min-width|min-height|max-width|max-height)\s*:\s*(.+);')
raw=[]
for p in css_files:
    for i,line in enumerate(p.read_text().splitlines(),1):
        m=visual_props.match(line)
        if not m: continue
        value=m.group(2).strip()
        if 'var(--lcl-' in value: continue
        if value in {'0','auto','none','inherit','initial','currentColor','100%','100vw','100vh','fit-content','max-content','min-content'}: continue
        if value.startswith('calc(') and 'var(--lcl-' in value: continue
        raw.append((str(p),i,m.group(1),value))
print('RAW_VISUAL_DECLARATIONS=' + str(len(raw)))
for p,i,prop,val in raw[:120]: print(f'  {p}:{i}: {prop}: {val}')

print('\n=== TOKEN DEFINITION / USAGE ===')
token_css=(root/'packages/design-tokens/src/styles.css').read_text()
defs=re.findall(r'(--lcl-[\w-]+)\s*:', token_css)
uses=Counter(re.findall(r'var\((--lcl-[\w-]+)', css))
print('TOKEN_DEFINITIONS=' + str(len(set(defs))))
unused=[d for d in sorted(set(defs)) if uses[d]==0]
print('TOKENS_UNUSED_BY_MOBILE=' + str(len(unused)))
for d in unused[:100]: print('  '+d)
print('TOP_TOKEN_USES:')
for token,count in uses.most_common(40): print(f'  {count:4d} {token}')

print('\n=== SCREEN / NAVIGATION CONSISTENCY ===')
seen=set()
for p in sorted(list(mobile.rglob('*Screen.tsx')) + list(mobile.rglob('*Detail.tsx'))):
    if p in seen: continue
    seen.add(p)
    text=p.read_text()
    print(f'{p}: lines={len(text.splitlines())} bottomNav={text.count("AppBottomNavigation")} bottomShell={text.count("app-bottom-nav-shell")} pageHeader={text.count("app-page-header")} modal={text.count("<Modal")}')

print('\n=== CSS SELECTOR / PATTERN SIGNALS ===')
selectors=[]
for p in css_files:
    for line in p.read_text().splitlines():
        s=line.strip()
        if s.endswith('{') and not s.startswith('@'):
            selectors.append(s[:-1].strip())
counts=Counter(selectors)
for sel,count in counts.most_common():
    if count > 1:
        print(f'{count:3d} {sel}')

print('\n=== LARGE COMPONENT TARGETS WITH STATE/HOOK COUNTS ===')
for n,p in sorted(rows, reverse=True):
    if not p.startswith('apps/mobile/src/') or not p.endswith(('.tsx','.ts')) or n < 250: continue
    text=Path(p).read_text()
    stats={
      'useState':text.count('useState('), 'useEffect':text.count('useEffect('),
      'useMemo':text.count('useMemo('), 'useCallback':text.count('useCallback('),
      'useQuery':text.count('useQuery('), 'useMutation':text.count('useMutation('),
      'Modal':text.count('<Modal'), 'section':text.count('<section')
    }
    print(f'{n:5d} {p} ' + ' '.join(f'{k}={v}' for k,v in stats.items()))

print('\n=== QUALITY GATES CONFIG SIGNALS ===')
for path in ['scripts/quality/ux-gate.mjs','scripts/quality/repository-gate.mjs','package.json','apps/mobile/package.json']:
    p=root/path
    if p.exists():
        print(f'--- {path} ({len(p.read_text().splitlines())} lines) ---')
        for i,line in enumerate(p.read_text().splitlines(),1):
            if any(k in line for k in ['max','limit','threshold','px','token','screen','component','lint','quality','e2e','check']):
                print(f'{i}: {line[:220]}')

print('\n=== DUPLICATED UI STRINGS / DIRECT POLISH TEXT IN TSX ===')
polish=[]
rx=re.compile(r'[>\'\"]([^<>\'\"]*[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ][^<>\'\"]*)[<\'\"]')
for p in mobile.rglob('*.tsx'):
    text=p.read_text()
    for i,line in enumerate(text.splitlines(),1):
        if rx.search(line): polish.append((str(p),i,line.strip()))
print('DIRECT_POLISH_TEXT_LINES=' + str(len(polish)))
for p,i,line in polish[:80]: print(f'  {p}:{i}: {line[:180]}')

print('\nPRODUCTION_READINESS_AUDIT_OK=1')
PY
