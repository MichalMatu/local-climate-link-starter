import { describe, expect, it } from 'vitest';
import type { Translate } from '../app/i18n.js';
import { formatDiagnosticReason } from '../flows/installations/diagnosticPresentation.js';

const t = ((key: string) => {
  if (key === 'dashboard.health.unknown') return 'Stan nieznany';
  if (key === 'hardware.diagnosticsReason.bl') return 'Poniżej progu';
  return key;
}) as Translate;

describe('diagnostic presentation', () => {
  it('maps known runtime abbreviations', () =>
    expect(formatDiagnosticReason('bl', t)).toBe('Poniżej progu'));
  it('does not expose unknown runtime abbreviations', () =>
    expect(formatDiagnosticReason('xyz', t)).toBe('Stan nieznany'));
});
