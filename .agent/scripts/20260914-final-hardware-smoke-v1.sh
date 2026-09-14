#!/usr/bin/env bash
set -euo pipefail

REPO='MichalMatu/local-climate-link-starter'
WORK_BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='931d59e1a319e9e5fc111b840baf248e995e239e'
ROOT='/Users/michal/agent-workspace/repos/local-climate-link-starter/work'
cd "$ROOT"

git fetch origin "$WORK_BRANCH" agent-control
ACTUAL_REMOTE="$(git rev-parse "origin/$WORK_BRANCH")"
[[ "$ACTUAL_REMOTE" == "$EXPECTED_HEAD" ]] || {
  echo "Unexpected work branch head: $ACTUAL_REMOTE" >&2
  exit 20
}
git checkout "$WORK_BRANCH"
git reset --hard "$EXPECTED_HEAD"

printf 'SHELLY_URL_PRESENT=%s\n' "$([[ -n "${SHELLY_URL:-}" ]] && echo yes || echo no)"
printf 'SHELLY_DEVICE_ID_PRESENT=%s\n' "$([[ -n "${SHELLY_DEVICE_ID:-}" ]] && echo yes || echo no)"

if [[ -z "${SHELLY_URL:-}" || -z "${SHELLY_DEVICE_ID:-}" ]]; then
  echo 'HARDWARE_SMOKE_SKIPPED=missing_env'
  exit 0
fi

final_off() {
  set +e
  curl -fsS -X POST "$SHELLY_URL/rpc/Switch.Set" \
    -H 'Content-Type: application/json' \
    --data '{"id":0,"on":false}' >/dev/null
  OFF_SET_RC=$?
  STATUS_JSON="$(curl -fsS -X POST "$SHELLY_URL/rpc/Switch.GetStatus" \
    -H 'Content-Type: application/json' \
    --data '{"id":0}' 2>/dev/null)"
  STATUS_RC=$?
  if [[ "$OFF_SET_RC" -ne 0 || "$STATUS_RC" -ne 0 ]]; then
    echo 'FINAL_RELAY_OFF_VERIFIED=no'
    return 91
  fi
  STATUS_ON="$(printf '%s' "$STATUS_JSON" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s); process.stdout.write(String(Boolean(j.output)));});")"
  if [[ "$STATUS_ON" != 'false' ]]; then
    echo 'FINAL_RELAY_OFF_VERIFIED=no'
    return 92
  fi
  echo 'FINAL_RELAY_OFF_VERIFIED=yes'
  return 0
}

trap 'rc=$?; final_off || off_rc=$?; if [[ ${off_rc:-0} -ne 0 ]]; then exit "$off_rc"; fi; exit "$rc"' EXIT

pnpm exec tsx scripts/hardware/device-rule-plug-smoke.ts
pnpm exec tsx scripts/hardware/runtime-mode-smoke.ts

echo 'HARDWARE_SMOKES=passed'
