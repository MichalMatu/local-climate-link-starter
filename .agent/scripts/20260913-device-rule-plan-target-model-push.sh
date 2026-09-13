#!/usr/bin/env bash
set -euo pipefail

branch='work/device-rule-decoupling-20260913'
old='9e3507529a432ccf84633835a041e407652bae86'
new='70c8fb0e989200479a05e57516ad12fbe763b8d5'

git fetch --prune origin "$branch"
git cat-file -e "$new^{commit}"
test "$(git rev-parse "$new^")" = "$old"
test "$(git rev-parse "origin/$branch")" = "$old"
git push origin "$new:refs/heads/$branch"
test "$(git ls-remote origin "refs/heads/$branch" | awk '{print $1}')" = "$new"
echo "REMOTE_HEAD=$new"
