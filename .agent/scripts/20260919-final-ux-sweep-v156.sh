#!/usr/bin/env bash
set -euo pipefail

echo '=== MODALS ==='
grep -RIn '<Modal' apps/mobile/src/screens apps/mobile/src/app | sort || true

echo '=== OLD PAGE CHROME ==='
grep -RInE 'demo-header|setup-context__back' apps/mobile/src/screens apps/mobile/src/app apps/mobile/src/routes | sort || true

echo '=== APP PAGE BACK USAGES ==='
grep -RIn 'AppPageBack' apps/mobile/src/screens apps/mobile/src/routes | sort || true

echo '=== ADVANCED MODAL REFERENCES ==='
grep -RIn 'RuleAdvancedSettingsModal' apps/mobile/src || true

echo '=== READONLY OR DISABLED INPUTS ==='
grep -RInE 'readOnly|disabled=\{true\}|aria-readonly' apps/mobile/src/screens apps/mobile/src/app | head -n 160 || true

echo '=== TECH PRESENTATION TOKENS ==='
grep -RInE 'DiagnosticRow|status-stack|runtimeAddress|baseUrl|scriptId|firmware|uptime|RSSI|dBm' apps/mobile/src/screens | head -n 260 || true

echo '=== SCROLL/FIXED CSS ==='
find apps/mobile/src -name '*.css' -print0 | xargs -0 grep -nE 'overflow(-[xy])?:|position:[[:space:]]*(fixed|sticky)|100vh|100dvh|min-height:[[:space:]]*100' | head -n 260 || true

echo '=== NESTED CARD HINTS ==='
grep -RInE 'automation-card|demo-panel|settings-modal-layout|installation-detail-identity|status-stack' apps/mobile/src/screens --include='*.tsx' | head -n 300 || true
