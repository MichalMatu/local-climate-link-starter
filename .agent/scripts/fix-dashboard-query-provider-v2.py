from pathlib import Path

path = Path('apps/mobile/src/__tests__/automation-dashboard-controls.test.tsx')
text = path.read_text()

old_import = "import { cleanup, fireEvent, render, screen } from '@testing-library/react';\n"
new_import = "import { QueryClient, QueryClientProvider } from '@tanstack/react-query';\nimport { cleanup, fireEvent, render, screen } from '@testing-library/react';\n"
if old_import not in text:
    raise SystemExit('testing-library import marker missing')
text = text.replace(old_import, new_import, 1)

old_render = """    render(\n      <I18nProvider>\n        <AutomationDashboardScreen\n          onAddAutomation={vi.fn()}\n          onOpenInstallation={vi.fn()}\n        />\n      </I18nProvider>\n    );\n"""
new_render = """    const queryClient = new QueryClient({\n      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }\n    });\n    render(\n      <I18nProvider>\n        <QueryClientProvider client={queryClient}>\n          <AutomationDashboardScreen\n            onAddAutomation={vi.fn()}\n            onOpenInstallation={vi.fn()}\n          />\n        </QueryClientProvider>\n      </I18nProvider>\n    );\n"""
if old_render not in text:
    raise SystemExit('dashboard controls render marker missing')
text = text.replace(old_render, new_render, 1)
path.write_text(text)
print('dashboard controls QueryClientProvider test fix applied')
