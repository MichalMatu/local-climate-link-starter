#!/usr/bin/env bash
set -euo pipefail

patch=/tmp/lcl-native-schedule-v3.patch
expected_patch=ad75af26820ae541b7b07227ec7f479676911ce8ab128740504c3649b020cdb2
expected_base=f92691b0f33d275510f1e22339c08bd2c9d1d7cb

test "$(git rev-parse HEAD)" = "$expected_base"
test -z "$(git status --porcelain)"
test "$(sha256sum "$patch" | awk '{print $1}')" = "$expected_patch"

git apply "$patch"
git diff --check
git add apps/mobile packages/shelly-client
test "$(git diff --cached --binary | sha256sum | awk '{print $1}')" = "$expected_patch"
git commit -m 'Add native time schedules'
git push origin work/native-time-schedule
test -z "$(git status --porcelain)"
printf 'commit_sha=%s\n' "$(git rev-parse HEAD)"
