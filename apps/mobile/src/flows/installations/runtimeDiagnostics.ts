import {
  diagnosticSnapshotSchema,
  type HardwareDiagnosticSnapshot
} from '../hardware-setup/schemas.js';
import { fetchShellyJson } from '../hardware-setup/shellyRequests.js';
import type { InstalledAutomation } from './model.js';

export type InstalledAutomationHealth = 'ok' | 'stale' | 'unknown';

const DIAGNOSTIC_TIMEOUT_MS = 5000;

export const fetchInstalledAutomationDiagnostics = async (
  installation: InstalledAutomation
): Promise<HardwareDiagnosticSnapshot> => {
  const endpoint = new URL(
    `/script/${installation.script.id}/diag`,
    installation.shelly.baseUrl
  );
  const payload = await fetchShellyJson(endpoint, DIAGNOSTIC_TIMEOUT_MS);
  const parsed = diagnosticSnapshotSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  return parsed.data;
};

export const installedAutomationHealth = (
  snapshot: HardwareDiagnosticSnapshot
): InstalledAutomationHealth => {
  const lastSeenUptimeMs = snapshot.diagnostics.lastSeenUptimeMs;
  const currentUptimeSec = snapshot.time.uptimeSec;

  if (snapshot.diagnostics.dataState === 'st') {
    return 'stale';
  }

  if (
    lastSeenUptimeMs == null ||
    !Number.isFinite(lastSeenUptimeMs) ||
    currentUptimeSec == null ||
    !Number.isFinite(currentUptimeSec)
  ) {
    return 'unknown';
  }

  const ageSec = Math.max(0, currentUptimeSec - lastSeenUptimeMs / 1000);
  return ageSec > snapshot.rule.staleTimeoutSec ? 'stale' : 'ok';
};
