#!/usr/bin/env sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-navigation-ux-consistency-v1.sh > /tmp/run-navigation-ux-consistency-v9-inner.sh
git show origin/agent-control:.agent/scripts/navigation-ux-v9-extra.py > /tmp/navigation-ux-v9-extra.py
git show origin/agent-control:.agent/scripts/navigation-ux-v9-inject.py > /tmp/navigation-ux-v9-inject.py
python3 /tmp/navigation-ux-v9-inject.py
sh /tmp/run-navigation-ux-consistency-v9-inner.sh
