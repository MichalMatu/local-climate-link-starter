from pathlib import Path

# 1) Dashboard itself no longer owns a duplicate zero-installation empty state.
path = Path('apps/mobile/src/__tests__/automation-dashboard.test.tsx')
text = path.read_text()
old = """  it('shows a useful empty state', () => {\n    const { onAddAutomation } = renderDashboard();\n\n    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();\n    expect(screen.getByText('Nie masz jeszcze zapisanej automatyki')).toBeVisible();\n    fireEvent.click(screen.getByRole('button', { name: 'Skonfiguruj pierwszy system' }));\n    expect(onAddAutomation).toHaveBeenCalledTimes(1);\n  });\n"""
new = """  it('does not duplicate the canonical zero-installation state', () => {\n    const { onAddAutomation } = renderDashboard();\n\n    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();\n    expect(screen.queryByText('Nie masz jeszcze zapisanej automatyki')).toBeNull();\n    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));\n    expect(onAddAutomation).toHaveBeenCalledTimes(1);\n  });\n"""
if old not in text:
    raise SystemExit('dashboard empty-state test marker missing')
path.write_text(text.replace(old, new, 1))

# 2) The setup-complete route test must simulate the real contract: successful
# setup persists an installation before calling onSetupComplete.
path = Path('apps/mobile/src/__tests__/app-routes.test.tsx')
text = path.read_text()
old = """  it('opens time setup and returns to the dashboard after setup completion', async () => {\n    renderRoutes();\n\n    fireEvent.click(screen.getByRole('button', { name: /Sterować według czasu/ }));\n    expect(await screen.findByText('mock-setup-time')).toBeVisible();\n\n    fireEvent.click(screen.getByRole('button', { name: 'mock-complete' }));\n    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();\n  });\n"""
new = """  it('opens time setup and returns to the dashboard after setup completion', async () => {\n    renderRoutes();\n\n    fireEvent.click(screen.getByRole('button', { name: /Sterować według czasu/ }));\n    expect(await screen.findByText('mock-setup-time')).toBeVisible();\n\n    const config = createDefaultShellyThermostatConfig(\n      'xiaomi_lywsd03mmc_bthome_v2',\n      'heating'\n    );\n    useInstalledAutomationStore.getState().upsertInstallation(\n      createInstalledAutomation({\n        shelly: { id: 'shellyplugsg3-setup-complete', model: 'S3PL-00112EU', gen: 3 },\n        shellyName: 'Salon',\n        baseUrl: 'http://192.168.0.20/',\n        scriptId: 1,\n        scriptHash: 'lcl-setup-complete',\n        config,\n        nowMs: 1000\n      })\n    );\n\n    fireEvent.click(screen.getByRole('button', { name: 'mock-complete' }));\n    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();\n  });\n"""
if old not in text:
    raise SystemExit('setup-complete route test marker missing')
path.write_text(text.replace(old, new, 1))

print('dashboard controls test expectations fixed')
