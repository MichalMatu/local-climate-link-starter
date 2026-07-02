import type { ShellyDeviceInfo, ShellyStatus } from '@lcl/shelly-client';
import { z } from 'zod';

const MIN_SYNCED_UNIX_TIME_SEC = 1_600_000_000;

export const scriptListSchema = z.object({
  scripts: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      enable: z.boolean().default(false),
      running: z.boolean().default(false)
    })
  )
});

export type ScriptListEntry = z.infer<typeof scriptListSchema>['scripts'][number];

export type HardwareSetupStatus = {
  deviceInfo: ShellyDeviceInfo;
  status: ShellyStatus;
  scripts: ScriptListEntry[];
};

const bleDiscoveryProfileCodeSchema = z.enum(['x', 't']);

const bleDiscoveryRawCandidateSchema = z.object({
  a: z.string(),
  p: bleDiscoveryProfileCodeSchema,
  t: z.number().nullable().optional(),
  h: z.number().nullable().optional(),
  r: z.number().nullable().optional(),
  s: z.number().nullable().optional()
});

const bleDiscoveryProfileCodeToId = (
  profileCode: z.infer<typeof bleDiscoveryProfileCodeSchema>
): 'xiaomi_lywsd03mmc_bthome_v2' | 'tp357_custom_v1' =>
  profileCode === 't' ? 'tp357_custom_v1' : 'xiaomi_lywsd03mmc_bthome_v2';

export const bleDiscoveryCandidateSchema = bleDiscoveryRawCandidateSchema.transform(
  (candidate) => ({
    runtimeAddress: candidate.a,
    profileId: bleDiscoveryProfileCodeToId(candidate.p),
    temperatureC: candidate.t,
    humidityPct: candidate.h,
    rssi: candidate.r,
    seenAt: candidate.s
  })
);

export const bleDiscoverySnapshotSchema = z
  .object({
    v: z.number(),
    r: z.boolean(),
    sa: z.number().nullable().optional(),
    so: z.number().nullable().optional(),
    lr: z.string().optional(),
    c: z.array(bleDiscoveryCandidateSchema)
  })
  .transform((snapshot) => ({
    version: snapshot.v,
    running: snapshot.r,
    startedAt: snapshot.sa,
    stoppedAt: snapshot.so,
    lastReason: snapshot.lr,
    candidates: snapshot.c
  }));

export type BleDiscoveryCandidate = z.infer<typeof bleDiscoveryCandidateSchema>;
export type BleDiscoverySnapshot = z.infer<typeof bleDiscoverySnapshotSchema>;

export const diagnosticSnapshotSchema = z
  .object({
    v: z.number(),
    z: z.string(),
    s: z.tuple([z.string(), z.string()]),
    q: z.tuple([
      z.union([z.literal(0), z.literal(1)]),
      z.union([z.literal(0), z.literal(1)]),
      z.number(),
      z.number(),
      z.number(),
      z.number()
    ]),
    y: z
      .tuple([z.string().nullable(), z.number().nullable(), z.number().nullable()])
      .nullable(),
    p: z
      .tuple([
        z.boolean(),
        z.number().nullable(),
        z.number().nullable(),
        z.number().nullable(),
        z.number().nullable(),
        z.number().nullable()
      ])
      .nullable(),
    g: z.tuple([
      z.number().nullable(),
      z.number().nullable(),
      z.number().nullable(),
      z.number().nullable(),
      z.number().nullable(),
      z.boolean(),
      z.string(),
      z.number().nullable(),
      z.number().nullable(),
      z.number(),
      z.number(),
      z.number().nullable(),
      z.number().nullable(),
      z.number().nullable(),
      z.number().nullable(),
      z.number().nullable(),
      z.string()
    ])
  })
  .transform((snapshot) => ({
    version: snapshot.v,
    script: {
      configHash: snapshot.z,
      running: true
    },
    sensor: {
      runtimeAddress: snapshot.s[0],
      displayName: snapshot.s[1]
    },
    rule: {
      control: {
        metric: snapshot.q[0] === 1 ? 'humidity' : 'temperature',
        direction: snapshot.q[1] === 1 ? 'above' : 'below',
        onThreshold: snapshot.q[2],
        offThreshold: snapshot.q[3]
      },
      staleTimeoutSec: snapshot.q[4],
      rssiMin: snapshot.q[5]
    },
    time: {
      localTime: snapshot.y?.[0] ?? null,
      unixTimeSec: snapshot.y?.[1] ?? null,
      uptimeSec: snapshot.y?.[2] ?? null,
      isSynced:
        typeof snapshot.y?.[1] === 'number' && snapshot.y[1] >= MIN_SYNCED_UNIX_TIME_SEC
    },
    plug: snapshot.p
      ? {
          relayState: snapshot.p[0],
          powerW: snapshot.p[1],
          voltageV: snapshot.p[2],
          currentA: snapshot.p[3],
          energyWh: snapshot.p[4],
          deviceTemperatureC: snapshot.p[5]
        }
      : null,
    diagnostics: {
      lastSeen: snapshot.g[0],
      lastTemp: snapshot.g[1],
      lastHumidity: snapshot.g[2],
      lastBattery: snapshot.g[3],
      lastRssi: snapshot.g[4],
      relayState: snapshot.g[5],
      lastReason: snapshot.g[6],
      lastChange: snapshot.g[7],
      onStarted: snapshot.g[8],
      onHits: snapshot.g[9],
      offHits: snapshot.g[10],
      lastControlValue: snapshot.g[11],
      lastVpd: snapshot.g[12],
      lastEffectiveOnThreshold: snapshot.g[13],
      lastEffectiveOffThreshold: snapshot.g[14],
      lastPacketSeen: snapshot.g[15],
      dataState: snapshot.g[16]
    }
  }));

export type HardwareDiagnosticSnapshot = z.infer<typeof diagnosticSnapshotSchema>;
