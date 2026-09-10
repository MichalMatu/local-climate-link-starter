from pathlib import Path
import json, re

ROOT = Path('.')
SOURCE_ROOTS = [Path('apps/mobile/src'), Path('packages'), Path('apps/landing/src')]
CODE_EXTS = {'.ts', '.tsx', '.js', '.mjs', '.css'}

def is_test(path: Path) -> bool:
    s = path.as_posix()
    return any(part in s for part in ['/__tests__/', '.test.', '.spec.', '/test/'])

files = []
for root in SOURCE_ROOTS:
    if not root.exists():
        continue
    for path in root.rglob('*'):
        if path.is_file() and path.suffix in CODE_EXTS and 'node_modules' not in path.parts:
            try:
                text = path.read_text()
            except UnicodeDecodeError:
                continue
            lines = text.count('\n') + (0 if text.endswith('\n') else 1)
            files.append((path, text, lines))

prod = [(p,t,n) for p,t,n in files if not is_test(p)]
print('=== TOP_PRODUCTION_FILES_BY_LINES ===')
for p,t,n in sorted(prod, key=lambda x: x[2], reverse=True)[:35]:
    print(f'{n:5d} {p.as_posix()}')

print('=== TOP_TEST_FILES_BY_LINES ===')
for p,t,n in sorted((x for x in files if is_test(x[0])), key=lambda x: x[2], reverse=True)[:15]:
    print(f'{n:5d} {p.as_posix()}')

print('=== TSX_RESPONSIBILITY_CONCENTRATION ===')
rows=[]
for p,t,n in prod:
    if p.suffix != '.tsx':
        continue
    hooks = {k: len(re.findall(rf'\b{k}\s*\(', t)) for k in ['useState','useEffect','useMemo','useCallback','useRef']}
    total_hooks=sum(hooks.values())
    jsx_controls=len(re.findall(r'<(?:button|input|select|textarea|Modal|details)\b', t))
    local_components=len(re.findall(r'\b(?:const|function)\s+[A-Z][A-Za-z0-9_]*\b', t))
    score=n + total_hooks*18 + jsx_controls*5 + max(local_components-3,0)*8
    rows.append((score,n,total_hooks,jsx_controls,local_components,p,hooks))
for score,n,h,c,lc,p,hooks in sorted(rows, reverse=True)[:25]:
    print(json.dumps({'path':p.as_posix(),'lines':n,'score':score,'hooks':hooks,'controls':c,'local_components':lc}, ensure_ascii=False))

print('=== FLOW_RESPONSIBILITY_CONCENTRATION ===')
rows=[]
for p,t,n in prod:
    if p.suffix not in {'.ts','.tsx'}:
        continue
    if '/flows/' not in p.as_posix() and '/hooks/' not in p.as_posix():
        continue
    async_count=len(re.findall(r'\basync\b', t))
    mutations=len(re.findall(r'\buseMutation\s*\(', t))
    queries=len(re.findall(r'\buseQuery\s*\(', t))
    state=len(re.findall(r'\buseState\s*\(', t))
    score=n + async_count*6 + mutations*20 + queries*15 + state*12
    rows.append((score,n,async_count,mutations,queries,state,p))
for score,n,a,m,q,s,p in sorted(rows, reverse=True)[:20]:
    print(json.dumps({'path':p.as_posix(),'lines':n,'score':score,'async':a,'mutations':m,'queries':q,'useState':s}, ensure_ascii=False))

print('=== TOKENIZATION_LITERAL_AUDIT ===')
css_scope=[]
for p,t,n in files:
    s=p.as_posix()
    if p.suffix=='.css' and (s.startswith('apps/mobile/src/') or s.startswith('packages/ui/src/') or s.startswith('apps/landing/src/styles/')):
        if s.endswith('/tokens.css'):
            continue
        css_scope.append((p,t))
prop_re=re.compile(r'^\s*([a-zA-Z-]+)\s*:\s*([^;]+);')
length_props=re.compile(r'^(?:margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|gap|row-gap|column-gap|border-radius|font-size|line-height|min-height|max-height|min-width|max-width|width|height|top|right|bottom|left|inset|outline-offset|box-shadow)$')
raw_len=re.compile(r'(?<![-\w])\d*\.?\d+(?:px|rem|em|vh|vw|dvh|dvw)\b')
raw_color=re.compile(r'#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(')
issues=[]
for p,t in css_scope:
    for i,line in enumerate(t.splitlines(),1):
        m=prop_re.match(line)
        if not m: continue
        prop,val=m.groups()
        if raw_color.search(val):
            issues.append((p.as_posix(),i,prop,val.strip(),'raw-color'))
        if length_props.match(prop) and raw_len.search(val) and 'var(--lcl-' not in val:
            issues.append((p.as_posix(),i,prop,val.strip(),'raw-length'))
by_file={}
for item in issues:
    by_file.setdefault(item[0],[]).append(item)
print(f'TOKEN_LITERAL_COUNT={len(issues)}')
for path,items in sorted(by_file.items(), key=lambda kv: len(kv[1]), reverse=True):
    print(f'{len(items):3d} {path}')
for item in issues[:120]:
    print(json.dumps({'path':item[0],'line':item[1],'property':item[2],'value':item[3],'kind':item[4]}, ensure_ascii=False))

print('=== RAW_INLINE_STYLE_AUDIT ===')
inline=[]
for p,t,n in prod:
    if p.suffix not in {'.ts','.tsx'}: continue
    for i,line in enumerate(t.splitlines(),1):
        if 'style={{' in line or 'style={' in line and ('px' in line or '#' in line or 'rgb' in line):
            inline.append((p.as_posix(),i,line.strip()))
print(f'INLINE_STYLE_SUSPECTS={len(inline)}')
for x in inline[:80]: print(json.dumps({'path':x[0],'line':x[1],'source':x[2]}, ensure_ascii=False))

print('=== DOCUMENTATION_STALENESS ===')
patterns=[
    ('MVP 1.0.0', re.compile(r'MVP `?1\.0\.0`?', re.I)),
    ('manual language switch', re.compile(r'no manual\s+language switch|no manual language', re.I)),
    ('settings modal', re.compile(r'app settings modal|settings modal|Ustawienia.*modal', re.I)),
    ('old dashboard top tabs', re.compile(r'top tabs|segmented control', re.I)),
]
for path in [Path('README.md'), Path('AGENTS.md'), *Path('docs').rglob('*.md')]:
    if not path.exists() or not path.is_file(): continue
    text=path.read_text(errors='ignore')
    for label,rx in patterns:
        for m in rx.finditer(text):
            line=text[:m.start()].count('\n')+1
            print(json.dumps({'path':path.as_posix(),'line':line,'kind':label,'match':m.group(0)}, ensure_ascii=False))

print('=== ARCHITECTURE_GUARD_COVERAGE ===')
for gate in ['scripts/quality/ux-gate.mjs','scripts/quality/repository-gate.mjs']:
    text=Path(gate).read_text()
    print(json.dumps({'path':gate,'lines':text.count(chr(10))+1,'mentions_tokens':'token' in text.lower(),'mentions_screen_boundaries':'screen' in text.lower(),'mentions_file_size':'line count' in text.lower() or 'max lines' in text.lower() or 'god' in text.lower()}, ensure_ascii=False))

print('=== AUDIT_DONE ===')
