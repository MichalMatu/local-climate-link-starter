#!/usr/bin/env bash
set -euo pipefail
REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
cd "$REPO"
git fetch --all --prune
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo '=== HEAD ==='
git rev-parse HEAD

echo '=== SHELLY PRESENTATION HISTORY ==='
git log --all --date=iso --format='%H %ad %s' -- apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx || true

echo '=== SHELLY PAGE HISTORY ==='
git log --all --date=iso --format='%H %ad %s' -- apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx || true

echo '=== DOTS / ELLIPSIS HISTORY ==='
for token in IconDots IconDotsVertical IconDotsCircle IconDotsCircleHorizontal '⋮' ellipsis kebab; do
  echo "--- $token ---"
  git log --all -G"$token" --oneline -- apps/mobile/src apps/mobile/src/theme || true
done

echo '=== COMMITS CONTAINING DOTS IN SHELLY FILE VERSIONS ==='
for c in $(git rev-list --all -- apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx); do
  for p in apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx; do
    if git cat-file -e "$c:$p" 2>/dev/null; then
      if git show "$c:$p" | grep -En 'IconDots|Dots|ellipsis|kebab|⋮|menu' >/tmp/lcl-card-hit.txt 2>/dev/null; then
        echo "COMMIT=$c PATH=$p"
        cat /tmp/lcl-card-hit.txt
      fi
    fi
  done
done

echo '=== HISTORICAL SHELLY CARD EXCERPTS ==='
for c in 4622d319ed90d1d03cb3eaa40d96fdf6cfa5160e 388212710ebb2ca9fd4097bf838ad4af78b60fdd 974a25872f05758a54437f37c931f6769793b4ea 0cd5b4ba20852bb53e9d10443be2aa16b6dc90a2; do
  p=apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx
  if git cat-file -e "$c:$p" 2>/dev/null; then
    echo "--- $c ---"
    git show "$c:$p" | sed -n '/export const SavedShellyDeviceCard/,/^};$/p' | head -n 260
  fi
done

echo '=== SENSOR COMPONENT IDENTITY ==='
CURRENT_SENSOR=$(git rev-parse HEAD:apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx)
echo "CURRENT_SENSOR_BLOB=$CURRENT_SENSOR"
for c in ad67e2f115ecd6f48200bfef83d27f8402d41de9 2258a0607d4476659cb855dc14546b1b5d2b955f 09f3b7e2f9e945d228146bb971f9ffd6797b532b; do
  if git cat-file -e "$c:apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx" 2>/dev/null; then
    echo "$c SENSOR_BLOB=$(git rev-parse "$c:apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx")"
  fi
done

echo '=== CURRENT SENSOR CARD CLASSES ==='
grep -nE 'sensor-saved-card|sensor-card-|sensor-metrics|sensor-reading|saved-list__item' apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx || true

echo '=== CURRENT THEME SENSOR/SHELLY RULES ==='
grep -nE '^\.(sensor-|shelly-|saved-list|device-|hardware-)' apps/mobile/src/theme/theme.css || true

echo '=== CSS DIFF ad67 -> HEAD RELEVANT ==='
git diff ad67e2f115ecd6f48200bfef83d27f8402d41de9..HEAD -- apps/mobile/src/theme/theme.css | grep -E -C 6 'sensor-|shelly-|saved-list' || true
