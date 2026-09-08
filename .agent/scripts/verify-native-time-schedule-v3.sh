#!/usr/bin/env bash
set -euo pipefail

prefix=/tmp/lcl-native-schedule-v3
: > "${prefix}.b64"

for part in 00a 00b 00c0 00c1 00c2 00c3 00c4 00c5 00c6 01 02 03; do
  git show "origin/agent-control:.agent/patches/20260908-native-schedule-zst-b64-${part}.part" >> "${prefix}.b64"
done

test "$(sha256sum "${prefix}.b64" | awk '{print $1}')" = "3d84af85888505c3f056c31e31176733528156ddd03c639a769b2d7c62ddbc10"
base64 -d "${prefix}.b64" > "${prefix}.zst"
test "$(sha256sum "${prefix}.zst" | awk '{print $1}')" = "198775eb204b6d9182f638bcbced64007372850ed8f1cdd1f56f70e40d9aac06"
zstd -d -f "${prefix}.zst" -o "${prefix}.patch"
test "$(sha256sum "${prefix}.patch" | awk '{print $1}')" = "ad75af26820ae541b7b07227ec7f479676911ce8ab128740504c3649b020cdb2"
git apply --check "${prefix}.patch"
printf 'verified_patch_sha=%s\n' "$(sha256sum "${prefix}.patch" | awk '{print $1}')"
