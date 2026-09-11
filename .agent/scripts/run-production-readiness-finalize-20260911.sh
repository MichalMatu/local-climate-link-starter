#!/usr/bin/env bash
set -euo pipefail

WORK_BRANCH=work/production-readiness-hardening-20260911
BASE_SHA=cfe916a19d798d0b5a216b97f726da7bcc02d3ee
CODE_SHA=2f42db968fa241c0d904d549befeaad249f48e18
ROLLBACK_SHA=4462a5246e06f7cebcb5808eace2d6278988e56e
ROLLBACK_TAG=stable-20260911-manual-runtime
PACKAGE=link.localclimate.app
SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Library/Android/sdk}}"
ADB="$SDK/platform-tools/adb"
APK=apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk

git fetch --prune origin main "$WORK_BRANCH" "$ROLLBACK_TAG" >/dev/null
test "$(git rev-parse origin/main)" = "$BASE_SHA"
test "$(git rev-parse "$ROLLBACK_TAG^{}")" = "$ROLLBACK_SHA"
WORK_SHA="$(git rev-parse "origin/$WORK_BRANCH")"
git merge-base --is-ancestor "$CODE_SHA" "$WORK_SHA"
test "$(git log -1 --pretty=%s "$WORK_SHA")" = "docs: close production readiness hardening"
git diff --check "$BASE_SHA...$WORK_SHA"

echo "FINAL_WORK_SHA=$WORK_SHA"
echo "FINAL_DIFF_FILES=$(git diff --name-only "$BASE_SHA...$WORK_SHA" | wc -l | tr -d ' ')"

git checkout main >/dev/null 2>&1 || git checkout -B main origin/main >/dev/null
git reset --hard origin/main >/dev/null
test -z "$(git status --porcelain)"
git merge --ff-only "origin/$WORK_BRANCH"
test "$(git rev-parse HEAD)" = "$WORK_SHA"

git push origin main
test "$(git ls-remote origin refs/heads/main | awk '{print $1}')" = "$WORK_SHA"

git push origin --delete "$WORK_BRANCH"
if git ls-remote --exit-code origin "refs/heads/$WORK_BRANCH" >/dev/null 2>&1; then
  echo "work branch still exists" >&2
  exit 1
fi

echo "PRODUCTION_READINESS_MAIN_SHA=$WORK_SHA"
echo "WORK_BRANCH_DELETED=1"

# Release sanity install is deliberately non-destructive: preserve app data with adb install -r.
if [[ -x "$ADB" ]]; then
  SERIALS="$("$ADB" devices | awk 'NR>1 && $2=="device" {print $1}')"
  COUNT="$(printf '%s\n' "$SERIALS" | sed '/^$/d' | wc -l | tr -d ' ')"
else
  COUNT=0
  SERIALS=""
fi

if [[ "$COUNT" == "1" ]]; then
  SERIAL="$(printf '%s\n' "$SERIALS" | sed '/^$/d')"
  pnpm --filter @lcl/mobile build
  pnpm --filter @lcl/mobile exec cap sync android
  printf 'sdk.dir=%s\n' "$SDK" > apps/mobile/android/local.properties
  (cd apps/mobile/android && ./gradlew --no-daemon assembleDebug)
  test -f "$APK"
  "$ADB" -s "$SERIAL" install -r "$APK"
  "$ADB" -s "$SERIAL" shell am force-stop "$PACKAGE"
  "$ADB" -s "$SERIAL" shell am start -W -n "$PACKAGE/.MainActivity" >/tmp/lcl-final-start.txt
  sleep 2
  PID="$("$ADB" -s "$SERIAL" shell pidof "$PACKAGE" | tr -d '\r')"
  test -n "$PID"
  MODEL="$("$ADB" -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
  RESUMED="$("$ADB" -s "$SERIAL" shell dumpsys activity activities | grep -m1 'mResumedActivity' || true)"
  printf '%s\n' "$RESUMED" | grep -q "$PACKAGE"
  echo "ANDROID_INSTALL_OK=1"
  echo "ANDROID_MODEL=$MODEL"
  echo "ANDROID_APP_FOREGROUND=1"
else
  echo "ANDROID_INSTALL_SKIPPED=authorized_device_count_$COUNT"
fi

test -z "$(git status --porcelain --untracked-files=no)"
echo "PRODUCTION_READINESS_FINALIZED=1"
