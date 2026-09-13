#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
cd "$REPO"

# The preceding foundation command is expected to leave generated runtime files in place
# after the known typed fixture failure. Refuse to continue if that did not happen.
for path in \
  apps/mobile/src/flows/rules/timeRuntime.ts \
  apps/mobile/src/flows/rules/climateRuntime.ts \
  apps/mobile/src/flows/rules/runtimeOwnership.ts \
  apps/mobile/src/flows/rules/timeRuntime.test.ts; do
  [[ -f "$path" ]] || { echo "Missing generated runtime file: $path" >&2; exit 2; }
done

cat > apps/mobile/src/flows/rules/timeRuntime.test.ts <<'EOF'
import type { ShellyScheduleJob, ShellyStatus } from '@lcl/shelly-client';
import { describe, expect, it } from 'vitest';
import { plug, time } from '../registry/fixtures.test-support.js';
import type { TimeRule } from './model.js';
import {
  deleteTimeRuleDeployment,
  deployTimeRule,
  type TimeRuleRuntimeClients
} from './timeRuntime.js';

class FakeTimeRuntime {
  relayOn = false;
  jobs: ShellyScheduleJob[] = [];
  nextId = 1;
  revision = 0;

  status(): ShellyStatus {
    return {
      matterEnabled: false,
      scripts: 'enabled',
      bluetooth: 'enabled',
      relayOn: this.relayOn,
      telemetry: {},
      clock: { timeSynced: true, localTime: '09:00', unixTimeSec: 1789282800 }
    };
  }

  clients(): TimeRuleRuntimeClients {
    return {
      device: {
        getStatus: async () => ({ ok: true, value: this.status() }),
        setRelayOn: async () => {
          this.relayOn = true;
          return { ok: true, value: null };
        },
        setRelayOff: async () => {
          this.relayOn = false;
          return { ok: true, value: null };
        }
      },
      schedules: {
        list: async () => ({
          ok: true,
          value: { jobs: this.jobs, rev: this.revision }
        }),
        create: async (config) => {
          const job: ShellyScheduleJob = {
            id: this.nextId++,
            enable: config.enable ?? true,
            timespec: config.timespec,
            calls: config.calls
          };
          this.jobs = [...this.jobs, job];
          this.revision += 1;
          return { ok: true, value: { id: job.id, rev: this.revision } };
        },
        update: async (id, patch) => {
          this.jobs = this.jobs.map((job) =>
            job.id === id
              ? {
                  ...job,
                  ...(patch.enable === undefined ? {} : { enable: patch.enable }),
                  ...(patch.timespec === undefined ? {} : { timespec: patch.timespec }),
                  ...(patch.calls === undefined ? {} : { calls: patch.calls })
                }
              : job
          );
          this.revision += 1;
          return { ok: true, value: { rev: this.revision } };
        },
        delete: async (id) => {
          this.jobs = this.jobs.filter((job) => job.id !== id);
          this.revision += 1;
          return { ok: true, value: { rev: this.revision } };
        }
      }
    };
  }
}

const ownership = async () => ({}) as never;

describe('time rule runtime', () => {
  it('installs one exact native pair per configured window and can delete it safely', async () => {
    const fake = new FakeTimeRuntime();
    const deployment = await deployTimeRule({
      rule: time,
      plug,
      rules: [time],
      deps: { requireOwnership: ownership, createClients: () => fake.clients() }
    });
    expect(deployment.pairs).toHaveLength(1);
    expect(fake.jobs).toHaveLength(2);
    expect(fake.jobs.every((job) => job.enable)).toBe(true);

    const deployed = { ...time, deployment } as TimeRule;
    await deleteTimeRuleDeployment(deployed, plug, {
      requireOwnership: ownership,
      createClients: () => fake.clients()
    });
    expect(fake.jobs).toEqual([]);
    expect(fake.relayOn).toBe(false);
  });

  it('supports multiple future-facing schedule windows without changing the runtime contract', async () => {
    const fake = new FakeTimeRuntime();
    const multi = {
      ...time,
      config: {
        schedule: {
          windows: [
            { days: [1, 2, 3, 4, 5] as const, start: '06:00', end: '08:00' },
            { days: [1, 2, 3, 4, 5] as const, start: '18:00', end: '22:00' }
          ]
        }
      }
    } as unknown as TimeRule;
    const deployment = await deployTimeRule({
      rule: multi,
      plug,
      rules: [multi],
      deps: { requireOwnership: ownership, createClients: () => fake.clients() }
    });
    expect(deployment.pairs).toHaveLength(2);
    expect(fake.jobs).toHaveLength(4);
  });
});
EOF

pnpm exec prettier --write apps/mobile/src/flows/rules/timeRuntime.test.ts
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile test -- src/flows/rules/runtimeOwnership.test.ts src/flows/rules/climateRuntime.test.ts src/flows/rules/timeRuntime.test.ts src/flows/rules/ownership.test.ts src/flows/rules/timeSchedule.test.ts src/flows/installations/runtimeControl.test.ts
pnpm quality:repo
pnpm quality:ux

git add \
  apps/mobile/src/flows/runtime/relaySafety.ts \
  apps/mobile/src/flows/installations/relaySafety.ts \
  apps/mobile/src/flows/rules/runtimeError.ts \
  apps/mobile/src/flows/rules/runtimeOwnership.ts \
  apps/mobile/src/flows/rules/climateRuntime.ts \
  apps/mobile/src/flows/rules/timeRuntime.ts \
  apps/mobile/src/flows/rules/runtimeOwnership.test.ts \
  apps/mobile/src/flows/rules/timeRuntime.test.ts \
  apps/mobile/src/flows/rules/climateRuntime.test.ts

git commit -m 'Add rule-centric runtime services'
FINAL_HEAD=$(git rev-parse HEAD)
BASE=$(git rev-parse HEAD^)
git fetch origin "$BRANCH"
REMOTE=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE" == "$BASE" ]] || { echo "Remote branch changed during runtime repair: $REMOTE != $BASE" >&2; exit 3; }
git push origin "$FINAL_HEAD:refs/heads/$BRANCH"
git fetch origin "$BRANCH"
[[ "$(git rev-parse "origin/$BRANCH")" == "$FINAL_HEAD" ]] || { echo 'Push verification failed' >&2; exit 4; }
printf 'FINAL_HEAD=%s\n' "$FINAL_HEAD"
