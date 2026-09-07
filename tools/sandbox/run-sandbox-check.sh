#!/usr/bin/env bash
set -euo pipefail

PROFILE=${1:-check}
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)

if [[ -z "${LCL_SANDBOX_ROOT:-}" ]]; then
  DEFAULT_ENV=/mnt/data/local-climate-link-sandbox/env.sh
  if [[ -f "$DEFAULT_ENV" ]]; then
    # shellcheck disable=SC1091
    source "$DEFAULT_ENV"
  else
    echo "LCL_SANDBOX_ROOT is not set. Source the generated env.sh first." >&2
    exit 2
  fi
fi

cd "$REPO_ROOT"

case "$PROFILE" in
  test)
    pnpm test
    ;;
  core)
    pnpm test:coverage:core
    ;;
  build)
    pnpm build
    ;;
  mobile)
    pnpm --filter @lcl/mobile lint
    pnpm --filter @lcl/mobile typecheck
    pnpm --filter @lcl/mobile test
    pnpm --filter @lcl/mobile build
    ;;
  landing)
    pnpm check:landing
    ;;
  check)
    pnpm check
    ;;
  full)
    pnpm check:full
    ;;
  *)
    echo "Unknown profile: $PROFILE" >&2
    echo "Expected one of: test, core, build, mobile, landing, check, full" >&2
    exit 2
    ;;
esac
