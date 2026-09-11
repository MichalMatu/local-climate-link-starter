#!/usr/bin/env sh
set -eu
git fetch origin work/ux-polish-20260911 >/dev/null
FILE=apps/mobile/src/__tests__/hardware-setup.test.tsx
git show origin/work/ux-polish-20260911:$FILE > /tmp/hardware-setup.test.tsx
printf '%s\n' '--- SETTINGS ---'
grep -n "Ustawienia gniazdka\|openShellyBleScanFromSettings\|Skanuj BLE\|Odśwież\|Stan zegara\|Zegar Shelly\|Usuń gniazdko tylko z aplikacji" /tmp/hardware-setup.test.tsx || true
