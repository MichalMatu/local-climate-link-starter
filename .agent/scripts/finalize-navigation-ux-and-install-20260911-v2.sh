#!/usr/bin/env sh
set -eu

BASE=d91da6045524d9ca6657f92d5b8b040502a3f1ae
FINAL=cfe916a19d798d0b5a216b97f726da7bcc02d3ee
FEATURE=8012d21e57d27f07b070f3e64b3432eb7b4abe2e
STABLE=4462a5246e06f7cebcb5808eace2d6278988e56e
BRANCH=work/navigation-ux-consistency-20260911
APP_ID=link.localclimate.app
APK=apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk

git fetch --prune origin
test "$(git rev-parse origin/main)" = "$BASE"
test "$(git rev-parse origin/$BRANCH)" = "$FINAL"
test "$(git rev-parse 'stable-20260911-manual-runtime^{}')" = "$STABLE"
test "$(git rev-parse "$FINAL^")" = "$FEATURE"

git checkout -B main origin/main >/dev/null
git merge --ff-only "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$FINAL"
test -z "$(git status --porcelain)"
git diff --check "$BASE" "$FINAL"

# One atomic push: advance main and remove the fully merged short-lived work branch.
git push --atomic origin main ":refs/heads/$BRANCH"
git fetch --prune origin main
test "$(git rev-parse origin/main)" = "$FINAL"
test -z "$(git ls-remote --heads origin "$BRANCH")"
test "$(git rev-parse 'stable-20260911-manual-runtime^{}')" = "$STABLE"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git branch -d "$BRANCH"
fi

command -v adb >/dev/null 2>&1
adb start-server >/dev/null
DEVICE_LINES="$(adb devices -l | awk 'NR>1 && $2=="device" {print $1}')"
DEVICE_COUNT="$(printf '%s\n' "$DEVICE_LINES" | sed '/^$/d' | wc -l | tr -d ' ')"
if [ "$DEVICE_COUNT" -ne 1 ]; then
  echo "ANDROID_DEVICE_COUNT=$DEVICE_COUNT"
  adb devices -l
  exit 21
fi
SERIAL="$(printf '%s\n' "$DEVICE_LINES" | sed -n '1p')"
MODEL="$(adb -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
MANUFACTURER="$(adb -s "$SERIAL" shell getprop ro.product.manufacturer | tr -d '\r')"
echo "ANDROID_DEVICE_MODEL=$MANUFACTURER $MODEL"

pnpm --filter @lcl/mobile build
(
  cd apps/mobile
  pnpm exec cap sync android
  cd android
  ./gradlew assembleDebug
)
test -f "$APK"
adb -s "$SERIAL" install -r "$APK"
adb -s "$SERIAL" shell am force-stop "$APP_ID"
adb -s "$SERIAL" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 2
PACKAGE_PATH="$(adb -s "$SERIAL" shell pm path "$APP_ID" | tr -d '\r')"
CURRENT_FOCUS="$(adb -s "$SERIAL" shell dumpsys window 2>/dev/null | grep -E 'mCurrentFocus|mFocusedApp' | grep "$APP_ID" | head -n 1 || true)"
test -n "$PACKAGE_PATH"

echo FINAL_MAIN_SHA=$(git rev-parse HEAD)
echo FINAL_STABLE_SHA=$(git rev-parse 'stable-20260911-manual-runtime^{}')
echo ANDROID_PACKAGE_PATH=$PACKAGE_PATH
if [ -n "$CURRENT_FOCUS" ]; then
  echo ANDROID_APP_FOREGROUND=1
else
  echo ANDROID_APP_FOREGROUND=0
fi
echo INSTALLED_APP_SHA=$FINAL
echo NAVIGATION_UX_MERGED_INSTALLED=1
