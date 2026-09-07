#!/usr/bin/env bash
set -euo pipefail

ROOT=${1:-/mnt/data/local-climate-link-sandbox}
OFFLINE_DIR=${2:-${LCL_OFFLINE_DIR:-}}
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
EXPECTED_NODE_MAJOR=22
EXPECTED_PNPM_VERSION=10.12.4

if [[ -z "$OFFLINE_DIR" ]]; then
  echo "Offline dependency directory is required." >&2
  echo "Usage: $0 <sandbox-root> <extracted-offline-pack>" >&2
  exit 2
fi

for required in \
  "$OFFLINE_DIR/pnpm-runtime/node_modules/.bin/pnpm" \
  "$OFFLINE_DIR/pnpm-store" \
  "$OFFLINE_DIR/ms-playwright" \
  "$OFFLINE_DIR/meta/dependency-key.txt"; do
  if [[ ! -e "$required" ]]; then
    echo "Missing offline-pack component: $required" >&2
    exit 3
  fi
done

node_major=$(node -p 'process.versions.node.split(".")[0]')
if [[ "$node_major" != "$EXPECTED_NODE_MAJOR" ]]; then
  echo "Sandbox pack requires Node $EXPECTED_NODE_MAJOR; found $(node --version)" >&2
  exit 4
fi

PNPM_BIN="$OFFLINE_DIR/pnpm-runtime/node_modules/.bin/pnpm"
pnpm_version=$($PNPM_BIN --version)
if [[ "$pnpm_version" != "$EXPECTED_PNPM_VERSION" ]]; then
  echo "Sandbox pack requires pnpm $EXPECTED_PNPM_VERSION; found $pnpm_version" >&2
  exit 5
fi

pack_key=$(cat "$OFFLINE_DIR/meta/dependency-key.txt")
snapshot_key_file="$REPO_ROOT/.sandbox-snapshot/dependency-key.txt"
if [[ -f "$snapshot_key_file" ]]; then
  snapshot_key=$(cat "$snapshot_key_file")
  if [[ "$snapshot_key" != "$pack_key" ]]; then
    echo "Source snapshot dependency key does not match the offline pack." >&2
    echo "source=$snapshot_key" >&2
    echo "offline=$pack_key" >&2
    exit 6
  fi
fi

mkdir -p "$ROOT"/{logs,tmp}

(
  cd "$REPO_ROOT"
  export CI=1
  export HUSKY=0
  export PLAYWRIGHT_BROWSERS_PATH="$OFFLINE_DIR/ms-playwright"
  "$PNPM_BIN" install \
    --offline \
    --frozen-lockfile \
    --store-dir "$OFFLINE_DIR/pnpm-store"
)

cat > "$ROOT/env.sh" <<ENV
export LCL_SANDBOX_ROOT="$ROOT"
export LCL_REPO_ROOT="$REPO_ROOT"
export LCL_OFFLINE_DIR="$OFFLINE_DIR"
export PLAYWRIGHT_BROWSERS_PATH="$OFFLINE_DIR/ms-playwright"
export TMPDIR="$ROOT/tmp"
export CI=1
export HUSKY=0
export PATH="$OFFLINE_DIR/pnpm-runtime/node_modules/.bin:\$PATH"
ENV

printf 'Local Climate Link sandbox prepared at %s\n' "$ROOT"
printf 'Dependency key: %s\n' "$pack_key"
printf 'Next: source %s/env.sh && tools/sandbox/sandbox-doctor.sh\n' "$ROOT"
