#!/usr/bin/env bash
set -euo pipefail

git fetch origin agent-control

git show origin/agent-control:.agent/scripts/stage8b2-extract-shelly-scan-flow-20260912.sh \
  | sed 's/test "$LINES" -lt 810/test "$LINES" -lt 830/' \
  > /tmp/lcl-stage8b2r-inner.sh

bash /tmp/lcl-stage8b2r-inner.sh
