#!/usr/bin/env sh
set -eu

BASE=4056035148a54d8b040eeda8bd7ce43d744e7765
BRANCH=work/production-readiness-hardening-20260911

git fetch --prune origin "$BRANCH" >/dev/null
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null
test -z "$(git status --porcelain)"

python3 - <<'PY'
from pathlib import Path
import re

# Remove unreachable setup intent branch left behind after the setup-first UX was retired.
p=Path('apps/mobile/src/flows/setup-intent.ts')
s=p.read_text()
s=s.replace("export type SetupIntent = 'temperature' | 'humidity' | 'time' | 'manage';", "export type SetupIntent = 'temperature' | 'humidity' | 'time';")
s=s.replace("    case 'time':\n    case 'manage':\n    case null:", "    case 'time':\n    case null:")
s=s.replace("    case 'time':\n    case 'manage':\n      return null;", "    case 'time':\n      return null;")
p.write_text(s)

p=Path('apps/mobile/src/flows/setup-intent.test.ts')
s=p.read_text()
s=s.replace("    expect(rulePresetsForSetupIntent('manage')).toEqual([\n      'heating',\n      'cooling',\n      'humidifying',\n      'dehumidifying'\n    ]);\n", "")
s=s.replace("    expect(defaultRulePresetForSetupIntent('manage')).toBeNull();\n", "    expect(defaultRulePresetForSetupIntent('time')).toBeNull();\n")
p.write_text(s)

p=Path('apps/mobile/src/routes/AppRoutes.tsx')
s=p.read_text()
s=s.replace("type SetupRouteIntent = Exclude<SetupIntent, 'manage'>;", "type SetupRouteIntent = SetupIntent;")
old="""  const selectIntent = (intent: SetupIntent, sourceKind: AppNavigationKind) => {
    if (intent === 'manage') {
      navigate({ type: 'dashboard', kind: sourceKind });
      return;
    }
    const nextKind = setupKindForIntent(intent);
    navigate({ type: 'setup', intent, sourceKind: nextKind });
  };
"""
new="""  const selectIntent = (intent: SetupIntent, sourceKind: AppNavigationKind) => {
    const nextKind = setupKindForIntent(intent);
    navigate({ type: 'setup', intent, sourceKind: nextKind });
  };
"""
if s.count(old)!=1: raise SystemExit(f'AppRoutes selectIntent marker mismatch: {s.count(old)}')
s=s.replace(old,new,1)
p.write_text(s)

# Remove dead locale branches: the entire legacy demo tree and intent.manage.
def property_span(text, prop, search_start=0, search_end=None):
    if search_end is None:
        search_end=len(text)
    m=re.search(rf'(?m)^([ \t]*){re.escape(prop)}:\s*\{{', text[search_start:search_end])
    if not m:
        raise SystemExit(f'property {prop} not found')
    line_start=search_start+m.start()
    brace=text.find('{', search_start+m.start(), search_end)
    depth=0
    quote=None
    escape=False
    i=brace
    while i<search_end:
        c=text[i]
        if quote:
            if escape: escape=False
            elif c=='\\': escape=True
            elif c==quote: quote=None
        else:
            if c in "'\"`": quote=c
            elif c=='{': depth+=1
            elif c=='}':
                depth-=1
                if depth==0:
                    j=i+1
                    while j<search_end and text[j] in ' \t': j+=1
                    if j<search_end and text[j]==',': j+=1
                    if j<search_end and text[j]=='\r': j+=1
                    if j<search_end and text[j]=='\n': j+=1
                    return line_start,j,brace,i+1
        i+=1
    raise SystemExit(f'unclosed property {prop}')

for p in sorted(Path('apps/mobile/src/app/locales').glob('*.ts')):
    text=p.read_text()
    # remove nested intent.manage first
    _,_,intent_open,intent_close=property_span(text,'intent')
    a,b,_,_=property_span(text,'manage',intent_open+1,intent_close)
    text=text[:a]+text[b:]
    # then remove legacy top-level demo block
    a,b,_,_=property_span(text,'demo')
    text=text[:a]+text[b:]
    p.write_text(text)

# Normalize blocking install feedback for the time setup page.
p=Path('apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx')
s=p.read_text()
s=s.replace("import { useTranslation } from '../../../app/i18n.js';", "import { FeedbackPanel, Modal } from '@lcl/ui';\nimport { useEffect, useState } from 'react';\nimport { useTranslation } from '../../../app/i18n.js';")
s=s.replace("  const timeFlow = useTimeAutomationSetupFlow(flow.selectedShelly);\n", "  const timeFlow = useTimeAutomationSetupFlow(flow.selectedShelly);\n  const [isInstallErrorOpen, setIsInstallErrorOpen] = useState(false);\n\n  useEffect(() => {\n    if (timeFlow.installMutation.isError) {\n      setIsInstallErrorOpen(true);\n    }\n  }, [timeFlow.installMutation.isError]);\n")
old="""      {timeFlow.installMutation.isError && (
        <p className="feedback-panel feedback-panel--warning" role="alert">
          {mutationError(timeFlow.installMutation.error)}
        </p>
      )}

      <div className="time-schedule-actions">"""
new="""      <div className="time-schedule-actions">"""
if s.count(old)!=1: raise SystemExit(f'time inline error marker mismatch: {s.count(old)}')
s=s.replace(old,new,1)
marker="""      </div>
    </section>
  );
};
"""
modal="""      </div>

      <Modal
        closeLabel={t('common.close')}
        open={isInstallErrorOpen && timeFlow.installMutation.isError}
        title={t('common.operationFailed')}
        onClose={() => {
          setIsInstallErrorOpen(false);
          timeFlow.installMutation.reset();
        }}
      >
        {timeFlow.installMutation.isError && (
          <FeedbackPanel tone="danger" title={t('common.operationFailed')}>
            {mutationError(timeFlow.installMutation.error)}
          </FeedbackPanel>
        )}
      </Modal>
    </section>
  );
};
"""
if s.count(marker)!=1: raise SystemExit(f'time modal insertion marker mismatch: {s.count(marker)}')
s=s.replace(marker,modal,1)
p.write_text(s)

# Add time setup to the same feedback/modal contract as the climate setup pages.
p=Path('scripts/quality/ux-gate.mjs')
s=p.read_text()
old="""  'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx',
  'apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx'
];"""
new="""  'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx',
  'apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx',
  'apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx'
];"""
if s.count(old)!=1: raise SystemExit(f'UX setup pages marker mismatch: {s.count(old)}')
s=s.replace(old,new,1)
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/setup-intent.ts \
  apps/mobile/src/flows/setup-intent.test.ts \
  apps/mobile/src/routes/AppRoutes.tsx \
  apps/mobile/src/app/locales/*.ts \
  apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx \
  scripts/quality/ux-gate.mjs

if git grep -n -E "'manage'|intent\.manage|demo\." -- apps/mobile/src; then
  echo 'dead setup intent/demo references remain' >&2
  exit 41
fi
if git grep -n 'role="alert"' -- apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx; then
  echo 'time setup still bypasses shared feedback contract' >&2
  exit 42
fi

git diff --check
pnpm check:full

git add apps/mobile/src scripts/quality/ux-gate.mjs
git diff --cached --check
git commit -m "refactor(mobile): remove legacy setup paths"
git push origin "$BRANCH"

echo "PRODUCTION_HYGIENE_V3_SHA=$(git rev-parse HEAD)"
echo 'PRODUCTION_HYGIENE_V3_OK=1'
