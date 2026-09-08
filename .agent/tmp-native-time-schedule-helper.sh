#!/usr/bin/env bash
set -euo pipefail

expected_apps=d5df258c7e45ffbde1f0ff23b2bc9cf92c91bb3f
expected_shelly=7ebff05ee0e208c9af652de691107e10eef5a303
expected_b64=3d84af85888505c3f056c31e31176733528156ddd03c639a769b2d7c62ddbc10
expected_zst=198775eb204b6d9182f638bcbced64007372850ed8f1cdd1f56f70e40d9aac06
expected_patch=ad75af26820ae541b7b07227ec7f479676911ce8ab128740504c3649b020cdb2
prefix=/tmp/lcl-native-schedule-final

test "$(git rev-parse HEAD:apps)" = "$expected_apps"
test "$(git rev-parse HEAD:packages/shelly-client)" = "$expected_shelly"
test -z "$(git status --porcelain)"

: > "${prefix}.b64"
for part in 00a 00b 00c0 00c1 00c2 00c3 00c4 00c5 00c6 01 02 03; do
  cat ".agent/patches/20260908-native-schedule-zst-b64-${part}.part" >> "${prefix}.b64"
done

test "$(sha256sum "${prefix}.b64" | awk '{print $1}')" = "$expected_b64"
base64 -D -i "${prefix}.b64" -o "${prefix}.zst"
test "$(sha256sum "${prefix}.zst" | awk '{print $1}')" = "$expected_zst"
zstd -d -f "${prefix}.zst" -o "${prefix}.patch"
test "$(sha256sum "${prefix}.patch" | awk '{print $1}')" = "$expected_patch"
git apply --check "${prefix}.patch"
git apply "${prefix}.patch"
git diff --check
git add apps/mobile packages/shelly-client
test "$(git diff --cached --binary | sha256sum | awk '{print $1}')" = "$expected_patch"
git commit -m 'Add native time schedules'
git push origin work/native-time-schedule
printf 'commit_sha=%s\n' "$(git rev-parse HEAD)"
