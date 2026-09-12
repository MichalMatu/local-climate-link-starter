#!/usr/bin/env bash
set -u

REPO="MichalMatu/local-climate-link-starter"
BRANCH="work/ux-polish-20260911"
BASE="ac1d2c900467be4330a09567f286a6c364072c9a"
ARTIFACT_ID="20260912-perfect-architecture-audit"
ARTIFACT_DIR=".agent/artifacts/$ARTIFACT_ID"
TMP="$(mktemp -d /tmp/lcl-architecture-audit.XXXXXX)"
CONTROL="$(mktemp -d /tmp/lcl-architecture-audit-control.XXXXXX)"
cleanup() {
  git worktree remove --force "$CONTROL" >/dev/null 2>&1 || true
  rm -rf "$TMP" "$CONTROL"
}
trap cleanup EXIT INT TERM

set -e
git fetch --prune origin "$BRANCH" agent-control >/dev/null
git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"
ROOT="$(pwd)"

set +e
pnpm quality:repo >"$TMP/quality-repo.log" 2>&1; QUALITY_REPO=$?
pnpm lint >"$TMP/lint.log" 2>&1; LINT=$?
pnpm typecheck >"$TMP/typecheck.log" 2>&1; TYPECHECK=$?
pnpm test >"$TMP/test.log" 2>&1; TEST=$?
pnpm test:coverage:core >"$TMP/coverage.log" 2>&1; COVERAGE=$?
pnpm build >"$TMP/build.log" 2>&1; BUILD=$?
pnpm format:check >"$TMP/format.log" 2>&1; FORMAT=$?
pnpm e2e:responsive >"$TMP/e2e-responsive.log" 2>&1; E2E=$?
set -e

cat >"$TMP/analyze.mjs" <<'JS'
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root=process.cwd();
const skip=new Set(['.git','node_modules','dist','build','coverage','.gradle','.idea','.vscode']);
const codeExt=new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs']);
const docExt=new Set(['.md','.mdx']);
function walk(dir,out=[]){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(skip.has(e.name)) continue;const p=path.join(dir,e.name);if(e.isDirectory()){if(p.includes('/apps/mobile/android/app/build')) continue;walk(p,out);} else out.push(p);}return out;}
const files=walk(root).map(p=>path.relative(root,p).replaceAll('\\','/'));
const code=files.filter(f=>codeExt.has(path.extname(f)));
const docs=files.filter(f=>docExt.has(path.extname(f))||f==='README.md'||f==='AGENTS.md');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const lineCount=s=>s.split(/\r?\n/).length;
const metrics=[]; const functions=[]; const todos=[];
for(const f of code){
  const src=read(f); const ext=path.extname(f); const kind=(ext==='.tsx'||ext==='.jsx')?ts.ScriptKind.TSX:ext==='.ts'?ts.ScriptKind.TS:ts.ScriptKind.JS;
  const sf=ts.createSourceFile(f,src,ts.ScriptTarget.Latest,true,kind);
  let imports=0,exports=0;
  const hooks={useState:0,useEffect:0,useMemo:0,useCallback:0,useRef:0,useMutation:0,useQuery:0};
  function visit(n){
    if(ts.isImportDeclaration(n)) imports++;
    if((ts.getCombinedModifierFlags(n)&ts.ModifierFlags.Export)!==0) exports++;
    if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&hooks[n.expression.text]!==undefined) hooks[n.expression.text]++;
    let name=null;
    if(ts.isFunctionDeclaration(n)&&n.name) name=n.name.text;
    else if(ts.isMethodDeclaration(n)&&n.name) name=n.name.getText(sf);
    else if((ts.isArrowFunction(n)||ts.isFunctionExpression(n))&&ts.isVariableDeclaration(n.parent)&&ts.isIdentifier(n.parent.name)) name=n.parent.name.text;
    if(name){const start=sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1; const end=sf.getLineAndCharacterOfPosition(n.end).line+1; functions.push({file:f,name,start,end,lines:end-start+1,params:n.parameters?.length??0});}
    ts.forEachChild(n,visit);
  }
  visit(sf);
  const ls=lineCount(src);
  metrics.push({file:f,lines:ls,imports,exports,hooks,hookTotal:Object.values(hooks).reduce((a,b)=>a+b,0)});
  src.split(/\r?\n/).forEach((line,i)=>{if(/\b(TODO|FIXME|HACK|XXX)\b/i.test(line)) todos.push({file:f,line:i+1,text:line.trim().slice(0,240)});});
}
for(const f of docs){const src=read(f);src.split(/\r?\n/).forEach((line,i)=>{if(/\b(TODO|FIXME|HACK|XXX|WIP)\b/i.test(line)) todos.push({file:f,line:i+1,text:line.trim().slice(0,240)});});}

function resolveImport(from,spec){if(!spec.startsWith('.')) return null;const base=path.posix.normalize(path.posix.join(path.posix.dirname(from),spec));for(const c of [base,base+'.ts',base+'.tsx',base+'.js',base+'.mjs',base+'/index.ts',base+'/index.tsx',base+'/index.js']) if(code.includes(c)) return c;return null;}
const edges=new Map(code.map(f=>[f,new Set()])); const incoming=new Map(code.map(f=>[f,new Set()]));
for(const f of code){const src=read(f);for(const m of src.matchAll(/(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g)){const dep=resolveImport(f,m[1]||m[2]);if(dep){edges.get(f).add(dep);incoming.get(dep).add(f);}}}
let idx=0;const stack=[];const on=new Set();const index=new Map();const low=new Map();const scc=[];
function strong(v){index.set(v,idx);low.set(v,idx++);stack.push(v);on.add(v);for(const w of edges.get(v)||[]){if(!index.has(w)){strong(w);low.set(v,Math.min(low.get(v),low.get(w)));} else if(on.has(w)) low.set(v,Math.min(low.get(v),index.get(w)));}if(low.get(v)===index.get(v)){const c=[];let w;do{w=stack.pop();on.delete(w);c.push(w);}while(w!==v);if(c.length>1)scc.push(c);}}
for(const f of code) if(!index.has(f)) strong(f);

const broken=[];const linkRe=/\[[^\]]*\]\(([^)]+)\)/g;
for(const f of docs){const src=read(f);for(const m of src.matchAll(linkRe)){let target=m[1].trim().split('#')[0].split('?')[0];if(!target||/^(?:https?:|mailto:|tel:|#)/.test(target)) continue;target=decodeURIComponent(target);const abs=path.resolve(root,path.dirname(f),target);if(!fs.existsSync(abs)) broken.push({file:f,target:m[1]});}}
const pkg=JSON.parse(read('package.json')); const currentVersion=pkg.version; const versionRefs=[];
for(const f of docs){const src=read(f);for(const m of src.matchAll(/v?(\d+\.\d+\.\d+)/g)){if(m[1]!==currentVersion) versionRefs.push({file:f,version:m[1]});}}

const result={
 currentVersion,
 counts:{files:files.length,codeFiles:code.length,docFiles:docs.length},
 largestCode:[...metrics].sort((a,b)=>b.lines-a.lines).slice(0,50),
 godCandidates:metrics.filter(x=>x.lines>=450||x.hookTotal>=16||x.imports>=28).sort((a,b)=>(b.lines+b.hookTotal*20+b.imports*5)-(a.lines+a.hookTotal*20+a.imports*5)),
 longFunctions:functions.filter(x=>x.lines>=80).sort((a,b)=>b.lines-a.lines).slice(0,100),
 fanIn:[...incoming].map(([file,s])=>({file,count:s.size})).sort((a,b)=>b.count-a.count).slice(0,40),
 fanOut:[...edges].map(([file,s])=>({file,count:s.size})).sort((a,b)=>b.count-a.count).slice(0,40),
 cycles:scc,
 todos,
 brokenDocLinks:broken,
 versionRefs,
 docs:docs.map(f=>({file:f,lines:lineCount(read(f))})).sort((a,b)=>b.lines-a.lines)
};
fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2));
JS
node "$TMP/analyze.mjs" "$TMP/metrics.json"

python3 - "$TMP/metrics.json" "$TMP/report.md" "$QUALITY_REPO" "$LINT" "$TYPECHECK" "$TEST" "$COVERAGE" "$BUILD" "$FORMAT" "$E2E" <<'PY'
import json,sys
p,out,*codes=sys.argv[1:]
d=json.load(open(p,encoding='utf-8'))
names=['quality:repo','lint','typecheck','test','coverage:core','build','format:check','e2e:responsive']
status=dict(zip(names,map(int,codes)))
with open(out,'w',encoding='utf-8') as f:
    f.write('# Deep architecture and cleanliness audit\n\n')
    f.write(f"Branch baseline: `ac1d2c900467be4330a09567f286a6c364072c9a`  \nPackage version: `{d['currentVersion']}`\n\n")
    f.write('## Verification\n\n')
    for n,c in status.items(): f.write(f"- {'PASS' if c==0 else 'FAIL'} `{n}` (exit {c})\n")
    f.write('\n## Repository scale\n\n')
    f.write(f"- Files: {d['counts']['files']}\n- Code files: {d['counts']['codeFiles']}\n- Documentation files: {d['counts']['docFiles']}\n\n")
    f.write('## God-object / oversized module candidates\n\n')
    for x in d['godCandidates'][:30]:
        h=', '.join(f"{k}={v}" for k,v in x['hooks'].items() if v)
        f.write(f"- `{x['file']}` — {x['lines']} lines, {x['imports']} imports, {x['hookTotal']} hooks{(' ('+h+')') if h else ''}\n")
    f.write('\n## Long functions / components\n\n')
    for x in d['longFunctions'][:40]: f.write(f"- `{x['file']}:{x['start']}` `{x['name']}` — {x['lines']} lines, {x['params']} params\n")
    f.write('\n## Highest fan-in\n\n')
    for x in d['fanIn'][:20]: f.write(f"- `{x['file']}` — {x['count']} importers\n")
    f.write('\n## Highest fan-out\n\n')
    for x in d['fanOut'][:20]: f.write(f"- `{x['file']}` — {x['count']} local dependencies\n")
    f.write('\n## Import cycles\n\n')
    if d['cycles']:
        for c in d['cycles']: f.write('- '+ ' -> '.join(f'`{x}`' for x in c)+'\n')
    else: f.write('- none detected in relative source imports\n')
    f.write('\n## Documentation integrity\n\n')
    f.write(f"- Broken relative links: {len(d['brokenDocLinks'])}\n")
    for x in d['brokenDocLinks'][:40]: f.write(f"  - `{x['file']}` -> `{x['target']}`\n")
    f.write(f"- References to versions different from current `{d['currentVersion']}`: {len(d['versionRefs'])}\n")
    seen=set()
    for x in d['versionRefs']:
        key=(x['file'],x['version'])
        if key not in seen:
            seen.add(key); f.write(f"  - `{x['file']}` references `{x['version']}`\n")
    f.write('\n### Largest docs\n\n')
    for x in d['docs'][:25]: f.write(f"- `{x['file']}` — {x['lines']} lines\n")
    f.write('\n## TODO / FIXME / HACK / XXX / WIP markers\n\n')
    if d['todos']:
        for x in d['todos'][:100]: f.write(f"- `{x['file']}:{x['line']}` {x['text']}\n")
    else: f.write('- none found\n')
PY

printf 'QUALITY_REPO=%s\nLINT=%s\nTYPECHECK=%s\nTEST=%s\nCOVERAGE=%s\nBUILD=%s\nFORMAT=%s\nE2E=%s\n' "$QUALITY_REPO" "$LINT" "$TYPECHECK" "$TEST" "$COVERAGE" "$BUILD" "$FORMAT" "$E2E" >"$TMP/status.txt"

test -z "$(git status --porcelain)"

git fetch origin agent-control >/dev/null
git worktree add --detach "$CONTROL" origin/agent-control >/dev/null
mkdir -p "$CONTROL/$ARTIFACT_DIR"
cp "$TMP/report.md" "$TMP/metrics.json" "$TMP/status.txt" "$CONTROL/$ARTIFACT_DIR/"
for x in quality-repo lint typecheck test coverage build format e2e-responsive; do cp "$TMP/$x.log" "$CONTROL/$ARTIFACT_DIR/$x.log"; done
(
 cd "$CONTROL"
 git add "$ARTIFACT_DIR"
 git commit -m "Capture deep architecture audit" >/dev/null
 if ! git push origin HEAD:agent-control >/dev/null 2>&1; then
   git fetch origin agent-control >/dev/null
   git rebase origin/agent-control >/dev/null
   git push origin HEAD:agent-control >/dev/null
 fi
 echo AUDIT_CONTROL_SHA=$(git rev-parse HEAD)
)
echo ARCH_AUDIT_BASE=$BASE
echo ARCH_AUDIT_ARTIFACT=$ARTIFACT_DIR
echo ARCH_AUDIT_DONE=1
