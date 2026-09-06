#!/usr/bin/env bash
set -euo pipefail

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

REPO_ROOT=${LCL_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}
EXPECTED_NODE_MAJOR=22
EXPECTED_PNPM_VERSION=10.12.4

for command_name in node pnpm; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing executable: $command_name" >&2
    exit 3
  fi
done

node_major=$(node -p 'process.versions.node.split(".")[0]')
if [[ "$node_major" != "$EXPECTED_NODE_MAJOR" ]]; then
  echo "Expected Node $EXPECTED_NODE_MAJOR; found $(node --version)" >&2
  exit 4
fi

pnpm_version=$(pnpm --version)
if [[ "$pnpm_version" != "$EXPECTED_PNPM_VERSION" ]]; then
  echo "Expected pnpm $EXPECTED_PNPM_VERSION; found $pnpm_version" >&2
  exit 5
fi

if [[ ! -f "$LCL_OFFLINE_DIR/meta/dependency-key.txt" ]]; then
  echo "Missing offline dependency key." >&2
  exit 6
fi

pack_key=$(cat "$LCL_OFFLINE_DIR/meta/dependency-key.txt")
snapshot_key_file="$REPO_ROOT/.sandbox-snapshot/dependency-key.txt"
if [[ -f "$snapshot_key_file" ]]; then
  snapshot_key=$(cat "$snapshot_key_file")
  if [[ "$snapshot_key" != "$pack_key" ]]; then
    echo "Source snapshot dependency key does not match the offline pack." >&2
    echo "source=$snapshot_key" >&2
    echo "offline=$pack_key" >&2
    exit 7
  fi
fi

printf 'repo=%s\n' "$REPO_ROOT"
printf 'node=%s\n' "$(node --version)"
printf 'pnpm=%s\n' "$pnpm_version"
printf 'dependency_key=%s\n' "$pack_key"

if [[ -f "$REPO_ROOT/.sandbox-snapshot/git-sha.txt" ]]; then
  printf 'source_snapshot_sha=%s\n' "$(cat "$REPO_ROOT/.sandbox-snapshot/git-sha.txt")"
else
  printf 'source_snapshot_sha=not-embedded (normal git checkout)\n'
fi

(
  cd "$REPO_ROOT"
  pnpm exec prettier --version >/dev/null
  pnpm exec eslint --version >/dev/null
  pnpm exec vitest --version >/dev/null
  pnpm exec vite --version >/dev/null
  pnpm exec tsc --version >/dev/null
)

if ! find "$PLAYWRIGHT_BROWSERS_PATH" -type f \( -name chrome -o -name headless_shell \) -print -quit | grep -q .; then
  echo "Playwright Chromium executable not found under $PLAYWRIGHT_BROWSERS_PATH" >&2
  exit 8
fi

printf 'node_dependencies=ok\n'
printf 'playwright_chromium=ok\n'
printf 'sandbox_doctor=ok\n'
