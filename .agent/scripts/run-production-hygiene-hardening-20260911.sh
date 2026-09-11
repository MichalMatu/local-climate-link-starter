#!/usr/bin/env sh
set -eu

BASE=cfe916a19d798d0b5a216b97f726da7bcc02d3ee
BRANCH=work/production-readiness-hardening-20260911

git fetch --prune origin main "$BRANCH" >/dev/null
test "$(git rev-parse origin/main)" = "$BASE"
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null
test -z "$(git status --porcelain)"

printf '%s\n' '=== DEAD DEMO REFERENCES BEFORE ==='
git grep -n -E 'DemoWizardScreen|useDemoSetupFlow|flows/demo' -- apps/mobile/src scripts || true

rm -f \
  apps/mobile/src/screens/DemoWizardScreen.tsx \
  apps/mobile/src/__tests__/demo-wizard.test.tsx \
  apps/mobile/src/flows/demo/useDemoSetupFlow.ts \
  apps/mobile/src/flows/demo/setupDraftStore.ts
rmdir apps/mobile/src/flows/demo 2>/dev/null || true

python3 - <<'PY'
from pathlib import Path
import re

# 1) Stop re-emitting every base token for explicit light mode. Base :root already
# carries light values; the prefers-dark selector explicitly excludes data-lcl-theme=light.
p = Path('packages/design-tokens/build/build-tokens.mjs')
s = p.read_text()
old = '''  ":root[data-lcl-theme='light'] {",
  '  color-scheme: light;',
  ...lightVariableLines,
  '}',
'''
new = '''  ":root[data-lcl-theme='light'] {",
  '  color-scheme: light;',
  '}',
'''
if s.count(old) != 1:
    raise SystemExit(f'light-token block mismatch: {s.count(old)}')
s = s.replace(old, new, 1)
p.write_text(s)

# 2) Tighten UX gate coverage and remove the unreachable demo screen contract.
p = Path('scripts/quality/ux-gate.mjs')
s = p.read_text()
old = "const cssPaths = ['apps/mobile/src/theme/theme.css', 'packages/ui/src/styles.css'];"
new = '''const cssPaths = [
  'apps/mobile/src/theme/theme.css',
  'apps/mobile/src/theme/runtimeStatus.css',
  'apps/mobile/src/app/appShell.css',
  'apps/mobile/src/screens/AutomationDashboardScreen.css',
  'apps/mobile/src/components/AppBottomNavigation.css',
  'packages/ui/src/styles.css'
];'''
if s.count(old) != 1:
    raise SystemExit(f'cssPaths marker mismatch: {s.count(old)}')
s = s.replace(old, new, 1)

s = s.replace("  'apps/mobile/src/screens/DemoWizardScreen.tsx'\n", '')
s = s.replace("  'apps/mobile/src/screens/DemoWizardScreen.tsx',\n", '')

# Remove the obsolete DemoWizard-specific feedback contract block.
start = s.find("  const demoPath = 'apps/mobile/src/screens/DemoWizardScreen.tsx';")
if start == -1:
    raise SystemExit('DemoWizard feedback block start missing')
end_marker = "\n  }\n};\n\nconst checkUiPackageFeedbackPatterns"
end = s.find(end_marker, start)
if end == -1:
    raise SystemExit('DemoWizard feedback block end missing')
# Preserve the function's closing brace and following declaration.
s = s[:start] + "};\n\nconst checkUiPackageFeedbackPatterns" + s[end + len(end_marker):]

# Add a guard that every production mobile CSS file participates in token checks.
marker = "const checkTokenizedCss = async () => {\n"
coverage = '''const checkTokenizedCssCoverage = async () => {
  const mobileCssPaths = (await listRepoFiles('apps/mobile/src')).filter((path) =>
    path.endsWith('.css')
  );
  for (const path of mobileCssPaths) {
    if (!tokenizedCssPaths.includes(path)) {
      addFailure(path, 'mobile production CSS must be included in token/responsive quality gates');
    }
  }
};

'''
if s.count(marker) != 1:
    raise SystemExit(f'checkTokenizedCss marker mismatch: {s.count(marker)}')
s = s.replace(marker, coverage + marker, 1)

# Tokenize typography as strictly as colors/z-index/border widths.
marker = '''      const rawOpacity = line.match(/\\bopacity:\\s*0\\.(?:55|62);/);
      if (rawOpacity) {
        addFailure(path, `line ${index + 1} uses non-tokenized opacity`);
      }
'''
addition = marker + '''
      const rawFontWeight = line.match(/\\bfont-weight:\\s*\\d+\\s*;/);
      if (rawFontWeight) {
        addFailure(path, `line ${index + 1} uses non-tokenized font weight`);
      }
'''
if s.count(marker) != 1:
    raise SystemExit(f'font-weight gate insertion marker mismatch: {s.count(marker)}')
s = s.replace(marker, addition, 1)

call_marker = 'await checkSavedShellyCardFeedback();\n'
if s.count(call_marker) != 1:
    raise SystemExit(f'gate call marker mismatch: {s.count(call_marker)}')
s = s.replace(call_marker, call_marker + 'await checkTokenizedCssCoverage();\n', 1)
p.write_text(s)

# 3) Replace raw typography weights with the existing design-token vocabulary.
weight_map = {
    '500': 'var(--lcl-font-weight-medium)',
    '700': 'var(--lcl-font-weight-semibold)',
    '800': 'var(--lcl-font-weight-bold)',
}
paths = list(Path('apps/mobile/src').rglob('*.css'))
paths += list(Path('packages/ui/src').rglob('*.css'))
paths += list(Path('apps/landing/src/styles').glob('*.css'))
counts = {key: 0 for key in weight_map}
for path in paths:
    text = path.read_text()
    for raw, token in weight_map.items():
        old = f'font-weight: {raw};'
        count = text.count(old)
        if count:
            counts[raw] += count
            text = text.replace(old, f'font-weight: {token};')
    path.write_text(text)
print('FONT_WEIGHT_REPLACEMENTS=' + ','.join(f'{k}:{v}' for k,v in counts.items()))
PY

pnpm --filter @lcl/design-tokens build
pnpm exec prettier --write \
  packages/design-tokens/build/build-tokens.mjs \
  packages/design-tokens/src/styles.css \
  packages/design-tokens/src/index.ts \
  scripts/quality/ux-gate.mjs \
  apps/mobile/src/theme/theme.css \
  apps/mobile/src/theme/runtimeStatus.css \
  apps/mobile/src/app/appShell.css \
  apps/mobile/src/screens/AutomationDashboardScreen.css \
  apps/mobile/src/components/AppBottomNavigation.css \
  packages/ui/src/styles.css \
  apps/landing/src/styles/*.css

printf '%s\n' '=== HARDENING GUARDS ==='
if git grep -n -E 'DemoWizardScreen|useDemoSetupFlow|flows/demo' -- apps/mobile/src scripts; then
  echo 'dead demo references remain' >&2
  exit 41
fi
if git grep -n -E 'font-weight:[[:space:]]*[0-9]+[[:space:]]*;' -- \
  'apps/mobile/src/**/*.css' 'packages/ui/src/**/*.css' 'apps/landing/src/styles/*.css'; then
  echo 'raw numeric font weight remains in tokenized production CSS' >&2
  exit 42
fi
if grep -A4 -F ":root[data-lcl-theme='light']" packages/design-tokens/src/styles.css | grep -q -- '--lcl-'; then
  echo 'explicit light theme still duplicates token values' >&2
  exit 43
fi

git diff --check
pnpm check:full

git status --short
git diff --stat

git add \
  packages/design-tokens/build/build-tokens.mjs \
  packages/design-tokens/src/styles.css \
  packages/design-tokens/src/index.ts \
  scripts/quality/ux-gate.mjs \
  apps/mobile/src \
  packages/ui/src/styles.css \
  apps/landing/src/styles

git diff --cached --check
git commit -m "refactor: harden production UI hygiene"
git push -u origin "$BRANCH"

echo "PRODUCTION_HYGIENE_SHA=$(git rev-parse HEAD)"
echo 'PRODUCTION_HYGIENE_OK=1'
