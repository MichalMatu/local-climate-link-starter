#!/usr/bin/env bash
set -euo pipefail
REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
ADB=/opt/homebrew/bin/adb
SERIAL=RFCT70L7E8J
PKG=link.localclimate.app
ACTIVITY=.MainActivity
cd "$REPO"

git fetch origin main agent-control
git checkout main
git reset --hard origin/main
git clean -fd

echo "MAIN_HEAD=$(git rev-parse HEAD)"
"$ADB" -s "$SERIAL" get-state | grep -qx device
"$ADB" -s "$SERIAL" shell am force-stop "$PKG"
"$ADB" -s "$SERIAL" shell am start -W -n "$PKG/$ACTIVITY" >/tmp/lcl-main-start.txt
sleep 2
cat /tmp/lcl-main-start.txt

echo '--- DEVTOOLS SOCKETS ---'
"$ADB" -s "$SERIAL" shell cat /proc/net/unix | grep -E 'webview_devtools_remote|chrome_devtools_remote' || true
SOCKET=$("$ADB" -s "$SERIAL" shell cat /proc/net/unix | sed -n 's/.*@\(webview_devtools_remote[^[:space:]]*\).*/\1/p' | head -n 1 | tr -d '\r')
if [ -z "$SOCKET" ]; then
  echo 'WEBVIEW_DEVTOOLS_AVAILABLE=no'
else
  echo "WEBVIEW_DEVTOOLS_AVAILABLE=yes"
  echo "WEBVIEW_SOCKET=$SOCKET"
  "$ADB" -s "$SERIAL" forward --remove tcp:9222 >/dev/null 2>&1 || true
  "$ADB" -s "$SERIAL" forward tcp:9222 "localabstract:$SOCKET"
  echo '--- CDP TARGETS ---'
  curl -fsS http://127.0.0.1:9222/json/list || true
fi

echo '--- UIAUTOMATOR ---'
"$ADB" -s "$SERIAL" shell uiautomator dump /sdcard/lcl-main-window.xml >/dev/null || true
"$ADB" -s "$SERIAL" shell cat /sdcard/lcl-main-window.xml | head -c 12000 || true
echo
