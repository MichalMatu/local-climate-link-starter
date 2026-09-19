from pathlib import Path

path = Path('apps/mobile/src/__tests__/automation-detail.test.tsx')
text = path.read_text()
text = text.replace('‹ Klimat', '‹ Gniazdka')
old = '''    const scriptBack = vi.fn();
    render(
      <I18nProvider>
        <InstallationScriptScreen installationId="missing-installation" onBack={scriptBack} />
      </I18nProvider>
    );
'''
new = '''    const scriptBack = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    render(
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <InstallationScriptScreen
            installationId="missing-installation"
            onBack={scriptBack}
          />
        </QueryClientProvider>
      </I18nProvider>
    );
'''
if old not in text:
    raise SystemExit('script missing-route render block not found')
path.write_text(text.replace(old, new, 1))
print('Fixed missing-page test labels and QueryClient harness')
