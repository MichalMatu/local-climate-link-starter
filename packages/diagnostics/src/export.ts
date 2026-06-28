import type { DiagnosticEvent } from './logger.js';
import { redactValue } from './redaction.js';
import type { RedactionOptions } from './redaction.js';

export interface SupportSummaryInput {
  appVersion: string;
  platform: string;
  blePermissionStatus: string;
  sensorProfile?: string;
  shellyRuntimeAddress?: string;
  shellyModel?: string;
  matterStatus?: string;
  scriptStatus?: string;
  relayState?: string;
  lastErrorKind?: string;
  events: readonly DiagnosticEvent[];
}

export const exportSupportSummary = (
  input: SupportSummaryInput,
  options: RedactionOptions = {}
): string => {
  const safeInput = redactValue(input, options) as SupportSummaryInput;
  const lines = [
    `app version: ${safeInput.appVersion}`,
    `platform: ${safeInput.platform}`,
    `BLE permission status: ${safeInput.blePermissionStatus}`,
    `sensor profile: ${safeInput.sensorProfile ?? 'not selected'}`,
    `Shelly runtime address: ${safeInput.shellyRuntimeAddress ?? 'not selected'}`,
    `Shelly model: ${safeInput.shellyModel ?? 'not selected'}`,
    `Matter status: ${safeInput.matterStatus ?? 'unknown'}`,
    `script status: ${safeInput.scriptStatus ?? 'unknown'}`,
    `relay state: ${safeInput.relayState ?? 'unknown'}`,
    `last error kind: ${safeInput.lastErrorKind ?? 'none'}`,
    'events:'
  ];

  for (const event of safeInput.events) {
    lines.push(
      `- ${new Date(event.atMs).toISOString()} [${event.severity}] ${event.kind}: ${
        event.message
      }`
    );
  }

  return `${lines.join('\n')}\n`;
};
