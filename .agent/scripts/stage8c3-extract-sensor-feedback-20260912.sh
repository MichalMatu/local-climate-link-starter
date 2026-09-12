#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
BASE='32e318484446bc34388e247b62be4639bf18d086'

git fetch --prune origin "$BRANCH" agent-control
git reset --hard
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

cat > apps/mobile/src/screens/hardware-setup/pages/useSensorSetupFeedback.ts <<'EOF'
import type { ToastTone } from '@lcl/ui';
import { useEffect, useRef } from 'react';
import type { Translate } from '../../../app/i18n.js';
import { mutationError } from '../helpers.js';
import type { SensorSetupFlow } from '../pageContracts.js';

type PushToast = (tone: ToastTone, title: string, detail?: string) => void;

type SensorSetupFeedbackOptions = {
  flow: SensorSetupFlow;
  shouldRunSavedSensorLiveScan: boolean;
  pushToast: PushToast;
  t: Translate;
};

export const useSensorSetupFeedback = ({
  flow,
  shouldRunSavedSensorLiveScan,
  pushToast,
  t
}: SensorSetupFeedbackOptions) => {
  const shownPhoneBleErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!flow.phoneBleScanMutation.isError) {
      return;
    }

    const message = mutationError(flow.phoneBleScanMutation.error);
    if (shownPhoneBleErrorRef.current === message) {
      return;
    }

    shownPhoneBleErrorRef.current = message;
    pushToast('warning', t('hardware.sensor.phoneBleFailedTitle'), message);
    flow.phoneBleScanMutation.reset();
  }, [flow.phoneBleScanMutation, pushToast, t]);

  useEffect(() => {
    if (!shouldRunSavedSensorLiveScan) {
      flow.stopSavedSensorLiveScan();
      return;
    }

    flow.startSavedSensorLiveScan();
    return () => flow.stopSavedSensorLiveScan();
  }, [
    flow.startSavedSensorLiveScan,
    flow.stopSavedSensorLiveScan,
    shouldRunSavedSensorLiveScan
  ]);

  useEffect(() => {
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;

    const clearResumeTimer = () => {
      if (resumeTimer !== null) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }
    };

    const scheduleResume = () => {
      if (!shouldRunSavedSensorLiveScan) {
        return;
      }

      clearResumeTimer();
      resumeTimer = setTimeout(() => {
        resumeTimer = null;
        void flow.restartSavedSensorLiveScan();
      }, 250);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearResumeTimer();
        flow.stopSavedSensorLiveScan();
        return;
      }

      scheduleResume();
    };

    const handleFocus = () => {
      if (document.visibilityState !== 'hidden') {
        scheduleResume();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearResumeTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [
    flow.restartSavedSensorLiveScan,
    flow.stopSavedSensorLiveScan,
    shouldRunSavedSensorLiveScan
  ]);

  useEffect(() => {
    if (!flow.setPvvxTimeMutation.isSuccess) {
      return;
    }

    pushToast(
      'ok',
      flow.setPvvxTimeMutation.data?.acknowledged
        ? t('hardware.sensor.pvvxTimeSetTitle')
        : t('hardware.sensor.pvvxTimeSentTitle')
    );
    flow.setPvvxTimeMutation.reset();
  }, [flow.setPvvxTimeMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.setPvvxTimeMutation.isError) {
      return;
    }

    pushToast(
      'warning',
      t('hardware.sensor.pvvxFailedTitle'),
      mutationError(flow.setPvvxTimeMutation.error)
    );
    flow.setPvvxTimeMutation.reset();
  }, [flow.setPvvxTimeMutation, pushToast, t]);

  const resetPhoneBleError = () => {
    shownPhoneBleErrorRef.current = null;
  };

  return { resetPhoneBleError };
};
EOF

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx')
s = p.read_text()
s = s.replace(
    "import { useEffect, useId, useRef, useState } from 'react';",
    "import { useId, useState } from 'react';"
)
s = s.replace(
    "import type { HardwarePageProps } from '../helpers.js';\n",
    "import type { HardwarePageProps } from '../helpers.js';\nimport { useSensorSetupFeedback } from './useSensorSetupFeedback.js';\n"
)
s = s.replace("  const shownPhoneBleErrorRef = useRef<string | null>(null);\n", "", 1)
s = s.replace("  const startSavedSensorLiveScan = flow.startSavedSensorLiveScan;\n", "", 1)
s = s.replace("  const restartSavedSensorLiveScan = flow.restartSavedSensorLiveScan;\n", "", 1)
s = s.replace("  const stopSavedSensorLiveScan = flow.stopSavedSensorLiveScan;\n", "", 1)
start_marker = """  useEffect(() => {
    if (!flow.phoneBleScanMutation.isError) {
      return;
    }

"""
end_marker = """  const closeAddSensorModal = () => {
"""
start = s.index(start_marker)
end = s.index(end_marker, start)
replacement = """  const { resetPhoneBleError } = useSensorSetupFeedback({
    flow,
    shouldRunSavedSensorLiveScan,
    pushToast,
    t
  });

"""
s = s[:start] + replacement + s[end:]
s = s.replace("    shownPhoneBleErrorRef.current = null;", "    resetPhoneBleError();")
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/pages/useSensorSetupFeedback.ts \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx

pnpm --dir apps/mobile exec vitest run src/__tests__/hardware-setup.test.tsx
pnpm check
LCL_E2E_PORT=5193 pnpm e2e:responsive

git diff --check
LINES=$(wc -l < apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx | tr -d ' ')
HOOK_LINES=$(wc -l < apps/mobile/src/screens/hardware-setup/pages/useSensorSetupFeedback.ts | tr -d ' ')
echo SENSOR_SETUP_PAGE_LINES="$LINES"
echo SENSOR_SETUP_FEEDBACK_LINES="$HOOK_LINES"
test "$LINES" -lt 620

git add \
  apps/mobile/src/screens/hardware-setup/pages/useSensorSetupFeedback.ts \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx
git commit -m 'Extract sensor setup feedback orchestration'
git push origin HEAD:"$BRANCH"

echo STAGE8C3_SHA=$(git rev-parse HEAD)
echo STAGE8C3_PARENT=$(git rev-parse HEAD^)
echo STAGE8C3_CHECK=1
echo STAGE8C3_E2E=1
echo STAGE8C3_PAGE_LINES="$LINES"
echo STAGE8C3_HOOK_LINES="$HOOK_LINES"
test -z "$(git status --porcelain)"
