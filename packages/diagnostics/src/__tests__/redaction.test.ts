import { exportSupportSummary, redactValue } from '../index.js';

describe('diagnostics redaction', () => {
  it('redacts secrets, tokens and auth headers', () => {
    const redacted = redactValue({
      token: 'gho_123456789',
      password: 'secret-password',
      headers: {
        authorization: 'Bearer abc.def.ghi'
      },
      nested: ['token gho_abcd']
    });

    expect(redacted).toEqual({
      token: '[REDACTED]',
      password: '[REDACTED]',
      headers: {
        authorization: '[REDACTED]'
      },
      nested: ['token [REDACTED_TOKEN]']
    });
  });

  it('optionally redacts IP and MAC addresses in exported support summary', () => {
    const summary = exportSupportSummary(
      {
        appVersion: '0.1.0',
        platform: 'web',
        blePermissionStatus: 'demo',
        shellyModel: 'Shelly Plug S Gen3 at 192.168.1.20',
        events: [
          {
            id: '1',
            atMs: 0,
            kind: 'shelly-status',
            severity: 'info',
            message: 'Device aa:bb:cc:dd:ee:ff responded from 192.168.1.20'
          }
        ]
      },
      { redactIp: true, redactMac: true }
    );

    expect(summary).toContain('[REDACTED_IP]');
    expect(summary).toContain('[REDACTED_MAC]');
    expect(summary).not.toContain('192.168.1.20');
    expect(summary).not.toContain('aa:bb:cc:dd:ee:ff');
  });
});
