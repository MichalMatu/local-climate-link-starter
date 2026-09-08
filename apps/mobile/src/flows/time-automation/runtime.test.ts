import type {
  Result,
  ShellyScheduleCreateResult,
  ShellyScheduleJob,
  ShellyScheduleJobConfig,
  ShellyScheduleMutationResult,
  ShellyStatus
} from '@lcl/shelly-client';
import { describe, expect, it } from 'vitest';
import { createTimeInstalledAutomation } from '../installations/model.js';
import type { TimeAutomationClients } from './runtime.js';
import {
  createDailyScheduleJob,
  deleteTimeAutomation,
  installDailyTimeAutomation,
  pauseTimeAutomation,
  readTimeAutomationRuntime,
  resumeTimeAutomation,
  updateDailyTimeAutomation
} from './runtime.js';

const ok = <T>(value: T): Result<T> => ({ ok: true, value });

class FakeTimeAutomationClients {
  relayOn = false;
  localTime = '12:00';
  timeSynced = true;
  jobs: ShellyScheduleJob[] = [];
  nextId = 1;
  failCreateAt: number | null = null;
  failUpdateAt: number | null = null;
  createCount = 0;
  updateCount = 0;
  calls: string[] = [];

  readonly device: TimeAutomationClients['device'] = {
    getStatus: async () => ok(this.status()),
    setRelayOn: async () => {
      this.calls.push('relay:on');
      this.relayOn = true;
      return ok(null);
    },
    setRelayOff: async () => {
      this.calls.push('relay:off');
      this.relayOn = false;
      return ok(null);
    }
  };

  readonly schedules: TimeAutomationClients['schedules'] = {
    list: async () => ok({ jobs: structuredClone(this.jobs), rev: 1 }),
    create: async (job) => {
      this.createCount += 1;
      this.calls.push(`schedule:create:${this.createCount}`);
      if (this.failCreateAt === this.createCount) {
        return {
          ok: false,
          error: {
            kind: 'unknown',
            userMessageKey: 'errors.shellyRpc',
            technicalMessage: 'create failed',
            retryable: true
          }
        };
      }
      const id = this.nextId++;
      this.jobs.push({ id, ...normalizeJob(job) });
      return ok({ id, rev: 1 } satisfies ShellyScheduleCreateResult);
    },
    update: async (id, patch) => {
      this.updateCount += 1;
      this.calls.push(`schedule:update:${id}`);
      if (this.failUpdateAt === this.updateCount) {
        return {
          ok: false,
          error: {
            kind: 'unknown',
            userMessageKey: 'errors.shellyRpc',
            technicalMessage: 'update failed',
            retryable: true
          }
        };
      }
      const index = this.jobs.findIndex((job) => job.id === id);
      if (index < 0) {
        return {
          ok: false,
          error: {
            kind: 'unknown',
            userMessageKey: 'errors.shellyRpc',
            technicalMessage: 'missing job',
            retryable: false
          }
        };
      }
      this.jobs[index] = {
        ...this.jobs[index],
        ...patch,
        ...(patch.calls ? { calls: patch.calls } : {})
      } as ShellyScheduleJob;
      return ok({ rev: 2 } satisfies ShellyScheduleMutationResult);
    },
    delete: async (id) => {
      this.calls.push(`schedule:delete:${id}`);
      this.jobs = this.jobs.filter((job) => job.id !== id);
      return ok({ rev: 2 } satisfies ShellyScheduleMutationResult);
    }
  };

  bundle(): TimeAutomationClients {
    return { device: this.device, schedules: this.schedules };
  }

  private status(): ShellyStatus {
    return {
      matterEnabled: false,
      scripts: 'enabled',
      bluetooth: 'enabled',
      relayOn: this.relayOn,
      telemetry: {},
      clock: {
        localTime: this.localTime,
        unixTimeSec: this.timeSynced ? 1_800_000_000 : 0,
        timeSynced: this.timeSynced
      }
    };
  }
}

const normalizeJob = (job: ShellyScheduleJobConfig): Omit<ShellyScheduleJob, 'id'> => ({
  enable: job.enable ?? true,
  timespec: job.timespec,
  calls: job.calls
});

const installationFor = (
  fake: FakeTimeAutomationClients,
  onJobId: number,
  offJobId: number
) =>
  createTimeInstalledAutomation({
    shelly: { id: 'shelly-a', model: 'S3PL-00112EU', gen: 3 },
    shellyName: 'Lamp',
    baseUrl: 'http://192.168.0.20/',
    onJobId,
    offJobId,
    config: { relayId: 0, onTime: '08:00', offTime: '20:00' },
    nowMs: 1
  });

describe('native Shelly time automation runtime', () => {
  it('installs two jobs and immediately applies the expected relay state', async () => {
    const fake = new FakeTimeAutomationClients();

    const installed = await installDailyTimeAutomation({
      clients: fake.bundle(),
      config: { relayId: 0, onTime: '08:00', offTime: '20:00' }
    });

    expect(installed).toEqual({ onJobId: 1, offJobId: 2 });
    expect(fake.jobs).toEqual([
      {
        id: 1,
        ...normalizeJob(
          createDailyScheduleJob({ relayId: 0, onTime: '08:00', offTime: '20:00' }, true)
        )
      },
      {
        id: 2,
        ...normalizeJob(
          createDailyScheduleJob({ relayId: 0, onTime: '08:00', offTime: '20:00' }, false)
        )
      }
    ]);
    expect(fake.relayOn).toBe(true);
  });

  it('rolls back the first job and leaves relay OFF if the second create fails', async () => {
    const fake = new FakeTimeAutomationClients();
    fake.failCreateAt = 2;

    await expect(
      installDailyTimeAutomation({
        clients: fake.bundle(),
        config: { relayId: 0, onTime: '08:00', offTime: '20:00' }
      })
    ).rejects.toThrow('create failed');

    expect(fake.jobs).toEqual([]);
    expect(fake.relayOn).toBe(false);
  });

  it('refuses to add a second native schedule owner for the relay', async () => {
    const fake = new FakeTimeAutomationClients();
    fake.jobs = [
      {
        id: 9,
        ...normalizeJob(
          createDailyScheduleJob({ relayId: 0, onTime: '06:00', offTime: '07:00' }, true)
        )
      }
    ];

    await expect(
      installDailyTimeAutomation({
        clients: fake.bundle(),
        config: { relayId: 0, onTime: '08:00', offTime: '20:00' }
      })
    ).rejects.toThrow('already controls this relay');
    expect(fake.createCount).toBe(0);
  });

  it('pauses, resumes and restores the correct live relay state', async () => {
    const fake = new FakeTimeAutomationClients();
    const ids = await installDailyTimeAutomation({
      clients: fake.bundle(),
      config: { relayId: 0, onTime: '08:00', offTime: '20:00' }
    });
    const installation = installationFor(fake, ids.onJobId, ids.offJobId);

    const paused = await pauseTimeAutomation(installation, fake.bundle());
    expect(paused.scheduleState).toBe('paused');
    expect(fake.relayOn).toBe(false);
    expect(fake.jobs.every((job) => !job.enable)).toBe(true);

    const resumed = await resumeTimeAutomation(installation, fake.bundle());
    expect(resumed.scheduleState).toBe('running');
    expect(fake.relayOn).toBe(true);
    expect(fake.jobs.every((job) => job.enable)).toBe(true);
  });

  it('updates both times while keeping the relay safely synchronized', async () => {
    const fake = new FakeTimeAutomationClients();
    const ids = await installDailyTimeAutomation({
      clients: fake.bundle(),
      config: { relayId: 0, onTime: '08:00', offTime: '20:00' }
    });
    const installation = installationFor(fake, ids.onJobId, ids.offJobId);

    const runtime = await updateDailyTimeAutomation({
      installation,
      config: { relayId: 0, onTime: '18:00', offTime: '23:00' },
      clients: fake.bundle()
    });

    expect(runtime.scheduleState).toBe('running');
    expect(fake.relayOn).toBe(false);
    expect(fake.jobs.find((job) => job.id === ids.onJobId)?.timespec).toContain('18');
    expect(fake.jobs.find((job) => job.id === ids.offJobId)?.timespec).toContain('23');
  });

  it('preserves a paused schedule when its times are edited', async () => {
    const fake = new FakeTimeAutomationClients();
    const ids = await installDailyTimeAutomation({
      clients: fake.bundle(),
      config: { relayId: 0, onTime: '08:00', offTime: '20:00' }
    });
    const installation = installationFor(fake, ids.onJobId, ids.offJobId);
    await pauseTimeAutomation(installation, fake.bundle());

    const runtime = await updateDailyTimeAutomation({
      installation,
      config: { relayId: 0, onTime: '18:00', offTime: '23:00' },
      clients: fake.bundle()
    });

    expect(runtime.scheduleState).toBe('paused');
    expect(fake.relayOn).toBe(false);
    expect(fake.jobs.every((job) => !job.enable)).toBe(true);
    expect(fake.jobs.find((job) => job.id === ids.onJobId)?.timespec).toContain('18');
    expect(fake.jobs.find((job) => job.id === ids.offJobId)?.timespec).toContain('23');
  });

  it('rolls back both job definitions when a partial schedule update fails', async () => {
    const fake = new FakeTimeAutomationClients();
    const ids = await installDailyTimeAutomation({
      clients: fake.bundle(),
      config: { relayId: 0, onTime: '08:00', offTime: '20:00' }
    });
    const installation = installationFor(fake, ids.onJobId, ids.offJobId);
    const before = structuredClone(fake.jobs);
    fake.updateCount = 0;
    fake.failUpdateAt = 4; // disable ON, disable OFF, update ON, then fail updating OFF

    await expect(
      updateDailyTimeAutomation({
        installation,
        config: { relayId: 0, onTime: '18:00', offTime: '23:00' },
        clients: fake.bundle()
      })
    ).rejects.toThrow('update failed');

    expect(fake.jobs).toEqual(before);
    expect(fake.relayOn).toBe(true);
  });

  it('reports expected setup preconditions with stable runtime error codes', async () => {
    const unsynced = new FakeTimeAutomationClients();
    unsynced.timeSynced = false;
    await expect(
      installDailyTimeAutomation({
        clients: unsynced.bundle(),
        config: { relayId: 0, onTime: '08:00', offTime: '20:00' }
      })
    ).rejects.toMatchObject({
      code: 'clock-unsynced'
    });

    const full = new FakeTimeAutomationClients();
    full.jobs = Array.from({ length: 19 }, (_, index) => ({
      id: index + 1,
      enable: true,
      timespec: `0 ${index} 1 * * SUN`,
      calls: [{ method: 'HTTP.GET', params: { url: `http://example/${index}` } }]
    }));
    await expect(
      installDailyTimeAutomation({
        clients: full.bundle(),
        config: { relayId: 0, onTime: '08:00', offTime: '20:00' }
      })
    ).rejects.toMatchObject({
      code: 'schedule-slots'
    });
  });

  it('deletes both jobs idempotently and confirms relay OFF', async () => {
    const fake = new FakeTimeAutomationClients();
    const ids = await installDailyTimeAutomation({
      clients: fake.bundle(),
      config: { relayId: 0, onTime: '08:00', offTime: '20:00' }
    });
    const installation = installationFor(fake, ids.onJobId, ids.offJobId);
    fake.jobs = fake.jobs.filter((job) => job.id !== ids.onJobId);

    await deleteTimeAutomation(installation, fake.bundle());

    expect(fake.jobs).toEqual([]);
    expect(fake.relayOn).toBe(false);
    await expect(
      readTimeAutomationRuntime(installation, fake.bundle())
    ).resolves.toMatchObject({
      scheduleState: 'attention'
    });
  });
});
