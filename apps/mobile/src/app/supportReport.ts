import mobilePackage from '../../package.json';
import type { RuntimeIssue } from './runtimeDiagnostics.js';

export type SupportReportDevice = {
  name: string;
  detail: string;
};

export type SupportReportInput = {
  platform: string;
  activeLocale: string;
  localePreference: string;
  themeMode: string;
  shellyDevices: readonly SupportReportDevice[];
  sensorDevices: readonly SupportReportDevice[];
  selectedShelly: string;
  selectedSensor: string;
  lastDiagnostics: readonly SupportReportDevice[];
  runtimeIssues: readonly RuntimeIssue[];
};

const formatDeviceList = (
  title: string,
  devices: readonly SupportReportDevice[]
): string[] => [
  title,
  ...(devices.length > 0
    ? devices.map((device) => `- ${device.name}: ${device.detail}`)
    : ['- none'])
];

const formatRuntimeIssues = (issues: readonly RuntimeIssue[]): string[] => [
  'Runtime issues',
  ...(issues.length > 0
    ? issues.slice(-10).map((issue) => `- ${issue.atIso} ${issue.kind}: ${issue.message}`)
    : ['- none'])
];

export const createSupportReport = (input: SupportReportInput): string =>
  [
    `Local Climate Link ${mobilePackage.version}`,
    `Platform: ${input.platform}`,
    `Locale: ${input.activeLocale}`,
    `Locale preference: ${input.localePreference}`,
    `Theme: ${input.themeMode}`,
    `Selected Shelly: ${input.selectedShelly}`,
    `Selected thermometer: ${input.selectedSensor}`,
    '',
    ...formatDeviceList('Shelly plugs', input.shellyDevices),
    '',
    ...formatDeviceList('Thermometers', input.sensorDevices),
    '',
    ...formatDeviceList('Last diagnostics', input.lastDiagnostics),
    '',
    ...formatRuntimeIssues(input.runtimeIssues)
  ].join('\n');
