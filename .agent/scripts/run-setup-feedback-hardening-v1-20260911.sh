#!/usr/bin/env sh
set -eu

BRANCH=work/production-readiness-hardening-20260911
EXPECTED=5504c9a390673057cdde23550ab710a6b419171a
git fetch --prune origin "$BRANCH" >/dev/null
test "$(git rev-parse "origin/$BRANCH")" = "$EXPECTED"
git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null
test -z "$(git status --porcelain)"

python3 - <<'PY'
from pathlib import Path

p=Path('apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx')
s=p.read_text()
s=s.replace(
    "import { DiagnosticRow, ToastViewport, type ToastMessage, type ToastTone } from '@lcl/ui';",
    "import { DiagnosticRow, ToastViewport } from '@lcl/ui';"
)
s=s.replace(
    "import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';",
    "import { useEffect, useState, type ReactNode } from 'react';"
)
helper_marker="""import {
  formatDiagnosticNumber,
  mutationError,
  type HardwarePageProps
} from '../helpers.js';
"""
if helper_marker not in s:
    raise SystemExit('Diagnostics helper import marker missing')
s=s.replace(helper_marker, helper_marker+"import { useToastQueue } from '../useToastQueue.js';\n",1)
old="""  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const toastIdRef = useRef(0);
"""
new="""  const [nowMs, setNowMs] = useState(() => Date.now());
  const { dismissToast, pushToast, toasts } = useToastQueue('diagnostics-toast');
"""
if s.count(old)!=1:
    raise SystemExit(f'Diagnostics toast state marker mismatch: {s.count(old)}')
s=s.replace(old,new,1)
old="""  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((tone: ToastTone, title: string, detail?: string) => {
    toastIdRef.current += 1;
    const id = `diagnostics-toast-${toastIdRef.current}`;
    const toast: ToastMessage =
      detail === undefined ? { id, tone, title } : { id, tone, title, detail };
    setToasts((current) => [...current.slice(-2), toast]);
  }, []);

"""
if s.count(old)!=1:
    raise SystemExit(f'Diagnostics toast functions marker mismatch: {s.count(old)}')
s=s.replace(old,'',1)
p.write_text(s)

p=Path('scripts/quality/ux-gate.mjs')
s=p.read_text()
marker="""  const rulePath = 'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx';
"""
ratchet="""  const cohesiveDialogStatePaths = [
    'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx',
    'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx',
    'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx'
  ];
  for (const path of cohesiveDialogStatePaths) {
    const source = await readRepoFile(path);
    if (/const \\[is[A-Z][A-Za-z0-9]*ModalOpen,\\s*setIs[A-Z][A-Za-z0-9]*ModalOpen\\]\\s*=\\s*useState/.test(source)) {
      addFailure(
        path,
        'setup pages with multiple dialogs must use one cohesive dialog state instead of independent modal booleans'
      );
    }
  }

"""
if s.count(marker)!=1:
    raise SystemExit(f'UX rule marker mismatch: {s.count(marker)}')
s=s.replace(marker,ratchet+marker,1)
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx \
  scripts/quality/ux-gate.mjs
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile lint
pnpm quality:ux
pnpm quality:repo
pnpm --filter @lcl/mobile test
pnpm check:full
git diff --check
git status --short
git add apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx scripts/quality/ux-gate.mjs
git commit -m "refactor(mobile): centralize setup feedback state"
git push origin "$BRANCH"
echo "SETUP_FEEDBACK_HARDENING_SHA=$(git rev-parse HEAD)"
echo 'SETUP_FEEDBACK_HARDENING_OK=1'
