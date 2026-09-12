import { describe, expect, it } from 'vitest';
import { t } from '../../app/i18n.js';
import { resolveScriptDiagnosticStatusMessage } from './useHardwareDiagnosticsFlow.js';

describe('hardware diagnostics status derivation', () => {
  it('does not report a diagnostic failure for a running script', () => {
    expect(resolveScriptDiagnosticStatusMessage({ running: true })).toBeNull();
  });

  it('maps out-of-memory failures to the dedicated diagnostic message', () => {
    expect(
      resolveScriptDiagnosticStatusMessage({ running: false, errors: ['out_of_memory'] })
    ).toBe(t('hardware.diagnostics.scriptOutOfMemory'));
  });

  it('maps other stopped script failures to the generic stopped diagnostic message', () => {
    expect(
      resolveScriptDiagnosticStatusMessage({
        running: false,
        errors: ['runtime_failure']
      })
    ).toBe(
      t('hardware.diagnostics.scriptNotRunning', {
        status: 'runtime_failure'
      })
    );
  });
});
