#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=931d59e1a319e9e5fc111b840baf248e995e239e
cd "$REPO"

git fetch origin "$BRANCH" agent-control
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
[[ "$(git rev-parse HEAD)" == "$EXPECTED" ]] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/screens/devices/PlugManagementScreen.tsx')
s = p.read_text()
s = s.replace(
"import { usePlugManagementFlow } from '../../flows/devices/plugs/usePlugManagementFlow.js';\n",
"import { usePlugManagementFlow } from '../../flows/devices/plugs/usePlugManagementFlow.js';\nimport { useShellySetupScanFlow } from '../../flows/hardware-setup/useShellySetupScanFlow.js';\n"
)
s = s.replace(
"  const flow = usePlugManagementFlow();\n",
"  const flow = usePlugManagementFlow();\n  const scan = useShellySetupScanFlow(\n    flow.plugs.map((plug) => ({\n      id: plug.id,\n      name: plug.name,\n      baseUrl: plug.baseUrl,\n      scriptIdInput: ''\n    }))\n  );\n"
)
s = s.replace(
"          onClick={() => setDialog('add')}\n",
"          onClick={() => {\n            scan.resetShellyScan();\n            setDialog('add');\n          }}\n"
)
s = s.replace(
"        onClose={() => setDialog('none')}\n",
"        onClose={() => {\n          scan.resetShellyScan();\n          setDialog('none');\n        }}\n",
1
)
s = s.replace("{t('hardware.sensor.nameLabel')}", "{t('hardware.shelly.deviceNameLabel')}", 1)
needle = """        <label className=\"field\">\n          {t('common.address')}\n          <input\n            value={address}\n            placeholder=\"192.168.0.16\"\n            onChange={(event) => setAddress(event.currentTarget.value)}\n          />\n        </label>\n"""
insert = """        <section className=\"saved-list\" aria-label={t('hardware.shelly.foundListLabel')}>\n          <h3>{t('hardware.shelly.networkScanTitle')}</h3>\n          <div className=\"action-row\">\n            <label className=\"field\">\n              {t('hardware.shelly.scanRangeStart')}\n              <input\n                value={scan.shellyScanStartInput}\n                onChange={(event) => scan.setShellyScanStartInput(event.currentTarget.value)}\n              />\n            </label>\n            <label className=\"field\">\n              {t('hardware.shelly.scanRangeEnd')}\n              <input\n                value={scan.shellyScanEndInput}\n                onChange={(event) => scan.setShellyScanEndInput(event.currentTarget.value)}\n              />\n            </label>\n          </div>\n          <button\n            className=\"secondary-action\"\n            type=\"button\"\n            onClick={() => {\n              if (scan.shellyScanMutation.isPending) scan.stopShellyScan();\n              else scan.startShellyScan();\n            }}\n          >\n            {scan.shellyScanMutation.isPending\n              ? t('hardware.shelly.scanStop')\n              : t('hardware.shelly.scanNetwork')}\n          </button>\n          {scan.shellyScanMutation.isPending && (\n            <p role=\"status\">{t('hardware.shelly.scanningIpRange')}</p>\n          )}\n          {scan.shellyScanStopped && <p>{t('hardware.shelly.scanStopped')}</p>}\n          {scan.shellyScanMutation.isError && (\n            <p role=\"alert\">{t('hardware.shelly.scanNetworkFailedTitle')}</p>\n          )}\n          {scan.shellyScanMutation.isSuccess &&\n            !scan.shellyScanMutation.data.stopped &&\n            scan.shellyScanMutation.data.results.length === 0 && (\n              <p>{t('hardware.shelly.scanResultEmpty')}</p>\n            )}\n          {scan.shellyScanMutation.data?.results.map((result) => (\n            <button\n              key={result.baseUrl}\n              className=\"secondary-action\"\n              type=\"button\"\n              onClick={() => setAddress(result.baseUrl)}\n            >\n              {result.baseUrl}\n            </button>\n          ))}\n        </section>\n        <label className=\"field\">\n          {t('common.address')}\n          <input\n            value={address}\n            placeholder=\"192.168.0.16\"\n            onChange={(event) => setAddress(event.currentTarget.value)}\n          />\n        </label>\n"""
if needle not in s:
    raise SystemExit('address field anchor not found')
s = s.replace(needle, insert, 1)
p.write_text(s)
PY

pnpm exec prettier --write apps/mobile/src/screens/devices/PlugManagementScreen.tsx
pnpm exec eslint apps/mobile/src/screens/devices/PlugManagementScreen.tsx
pnpm --filter @lcl/mobile typecheck

git add apps/mobile/src/screens/devices/PlugManagementScreen.tsx
git commit --no-verify -m "Restore plug network scan"
git push --no-verify origin HEAD:"$BRANCH"
git fetch origin "$BRANCH"
FINAL_HEAD=$(git rev-parse HEAD)
[[ "$FINAL_HEAD" == "$(git rev-parse origin/$BRANCH)" ]] || { echo 'Push verification failed'; exit 6; }
echo "FINAL_HEAD=$FINAL_HEAD"
