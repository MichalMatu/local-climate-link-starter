#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=06da99e9dcc72c0e66d12269cd6605b4536e4c7c
cd "$REPO"

git fetch origin "$BRANCH" agent-control
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
[[ "$(git rev-parse HEAD)" == "$EXPECTED" ]] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

echo '=== HEAD ==='
git rev-parse HEAD

echo '=== TARGET LEGACY REFERENCES ==='
for pattern in \
  'InstalledAutomation' \
  'installedAutomations' \
  'hardwareSetupDraft' \
  'setupDraftStore' \
  'flows/installations' \
  'time-automation' \
  'InstallationDetail' \
  'HardwareSetupFlow' \
  'useHardwareSetupFlow' \
  'installed automation' \
  'installation detail'; do
  echo "--- $pattern"
  git grep -n -i "$pattern" -- . ':!.agent' || true
done

echo '=== CURRENT PRODUCT/ARCHITECTURE DOC REFERENCES ==='
git grep -n -i -E 'rule|plug|thermometer|sensor|automation|installation|setup' -- docs README.md AGENTS.md 2>/dev/null | head -n 1200 || true

echo '=== DEVICE-RULE PROGRESS DOC ==='
if [[ -f docs/implementation/device-rule-decoupling-progress.md ]]; then
  cat docs/implementation/device-rule-decoupling-progress.md
fi

echo '=== DOC FILES ==='
find docs -type f -maxdepth 4 | sort

echo '=== MOBILE FLOW FILES ==='
find apps/mobile/src/flows -maxdepth 3 -type f | sort

echo '=== SCREEN FILES ==='
find apps/mobile/src/screens -maxdepth 4 -type f | sort

echo '=== TODO/FIXME/LEGACY MARKERS ==='
git grep -n -E 'TODO|FIXME|LEGACY|legacy|deprecated|backcompat|compatib' -- apps/mobile/src docs scripts packages AGENTS.md README.md 2>/dev/null || true

echo '=== BRANCH DIFF STAT FROM MAIN ==='
git diff --stat origin/main...HEAD

echo '=== BRANCH COMMITS FROM MAIN ==='
git log --oneline --decorate origin/main..HEAD
