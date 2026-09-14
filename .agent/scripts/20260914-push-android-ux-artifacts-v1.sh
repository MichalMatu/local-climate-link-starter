#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
ARTIFACT_COMMIT=f04bb8de
REMOTE_REF=refs/heads/agent-artifacts/android-ux-20260914-931d59e1
cd "$REPO"

git cat-file -e "${ARTIFACT_COMMIT}^{commit}"
git push origin "${ARTIFACT_COMMIT}:${REMOTE_REF}"
git fetch origin "${REMOTE_REF}:${REMOTE_REF}"
[[ "$(git rev-parse "$REMOTE_REF")" == "$(git rev-parse "$ARTIFACT_COMMIT")" ]]

echo "ARTIFACT_REF=$REMOTE_REF"
echo "ARTIFACT_HEAD=$(git rev-parse "$ARTIFACT_COMMIT")"
