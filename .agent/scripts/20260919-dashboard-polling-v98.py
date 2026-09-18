from pathlib import Path

ROOT = Path('.')

screen_path = ROOT / 'apps/mobile/src/screens/AutomationDashboardScreen.tsx'
screen = screen_path.read_text()
old = "const CLIMATE_READING_PULSE_MS = 650;\n"
new = "const CLIMATE_READING_PULSE_MS = 650;\nconst DASHBOARD_DIAGNOSTICS_REFRESH_MS = 5_000;\n"
if old not in screen:
    raise SystemExit('pulse constant anchor missing')
screen = screen.replace(old, new, 1)
old = "  const query = useInstalledAutomationDiagnostics(installation);\n  const control = useInstalledAutomationControl(installation);\n"
new = "  const query = useInstalledAutomationDiagnostics(installation, {\n    refetchInterval: DASHBOARD_DIAGNOSTICS_REFRESH_MS\n  });\n  const control = useInstalledAutomationControl(installation);\n"
if old not in screen:
    raise SystemExit('query anchor missing')
screen = screen.replace(old, new, 1)
old = "  const relayState =\n    controlStatus?.relayOn ??\n    snapshot?.plug?.relayState ??\n    snapshot?.diagnostics.relayState;\n"
new = "  const relayState =\n    snapshot?.plug?.relayState ??\n    controlStatus?.relayOn ??\n    snapshot?.diagnostics.relayState;\n"
if old not in screen:
    raise SystemExit('relay precedence anchor missing')
screen = screen.replace(old, new, 1)
screen_path.write_text(screen)

test_path = ROOT / 'apps/mobile/src/__tests__/automation-dashboard.test.tsx'
test = test_path.read_text()
old = "  lastVpd = 1.31,\n  dataState = 'ok'\n}: {\n  lastSeenUptimeMs?: number;\n  uptimeSec?: number;\n  effectiveOnThreshold?: number;\n  effectiveOffThreshold?: number;\n  lastVpd?: number | null;\n  dataState?: string;\n} = {}) => ({\n"
new = "  lastVpd = 1.31,\n  dataState = 'ok',\n  plugRelayOn = true,\n  ruleRelayOn = true\n}: {\n  lastSeenUptimeMs?: number;\n  uptimeSec?: number;\n  effectiveOnThreshold?: number;\n  effectiveOffThreshold?: number;\n  lastVpd?: number | null;\n  dataState?: string;\n  plugRelayOn?: boolean;\n  ruleRelayOn?: boolean;\n} = {}) => ({\n"
if old not in test:
    raise SystemExit('diagnostic options anchor missing')
test = test.replace(old, new, 1)
test = test.replace("  p: [true, 42.3, 230.1, 0.2, 1234, 31.2],", "  p: [plugRelayOn, 42.3, 230.1, 0.2, 1234, 31.2],", 1)
# Replace only the rule relay field in the diagnostic g array.
old = "    -51,\n    true,\n    'ok',\n"
new = "    -51,\n    ruleRelayOn,\n    'ok',\n"
if old not in test:
    raise SystemExit('diagnostic relay field anchor missing')
test = test.replace(old, new, 1)

anchor = "  it('derives current VPD from runtime temperature and humidity when Shelly omits it', async () => {\n"
insert = r'''  it('prefers the fresh diagnostic plug relay over a stale control poll for the icon', async () => {
    useInstalledAutomationStore.getState().upsertInstallation(installedAutomation());
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof URL ? input.toString() : String(input);
      const target = new URL(url, 'http://localhost').searchParams.get('target');
      if (url.includes('/script/1/diag') || target?.includes('/script/1/diag')) {
        return jsonResponse(diagnosticPayload({ plugRelayOn: true, ruleRelayOn: true }));
      }

      const body = JSON.parse(String(init?.body ?? '{}')) as {
        id?: number | string;
        method?: string;
      };
      return jsonResponse({ id: body.id ?? 1, result: controlRpcResult(body.method) });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderDashboard();

    const card = (await screen.findByText('Salon')).closest('article') as HTMLElement;
    const leadingIcon = card.querySelector('.automation-card__leading-icon');
    await waitFor(() =>
      expect(leadingIcon).toHaveClass('automation-card__leading-icon--active')
    );
  });

'''
if anchor not in test:
    raise SystemExit('test insertion anchor missing')
test = test.replace(anchor, insert + anchor, 1)

test_path.write_text(test)
print('Applied 5s dashboard diagnostics polling and physical relay precedence')
