from pathlib import Path

setup = Path('apps/mobile/src/screens/SetupIntentScreen.tsx')
text = setup.read_text()
old = """type SetupIntentScreenProps = {\n  onSelect(intent: SetupIntent): void;\n  onCancel?(): void;\n};\n"""
new = """type SetupIntentScreenProps = {\n  onSelect(intent: SetupIntent): void;\n  onCancel?(): void;\n  showManage?: boolean;\n};\n"""
if old not in text:
    raise SystemExit('setup props marker missing')
text = text.replace(old, new, 1)
old = "export const SetupIntentScreen = ({ onSelect, onCancel }: SetupIntentScreenProps) => {"
new = "export const SetupIntentScreen = ({ onSelect, onCancel, showManage = true }: SetupIntentScreenProps) => {"
if old not in text:
    raise SystemExit('setup component marker missing')
text = text.replace(old, new, 1)
old = """        {INTENT_CHOICES.map((choice) => (\n          <button\n"""
new = """        {INTENT_CHOICES.filter((choice) => showManage || choice.id !== 'manage').map((choice) => (\n          <button\n"""
if old not in text:
    raise SystemExit('setup choices marker missing')
text = text.replace(old, new, 1)
setup.write_text(text)

routes = Path('apps/mobile/src/routes/AppRoutes.tsx')
text = routes.read_text()
marker = """  if (route.type === 'intent') {\n    return (\n      <SetupIntentScreen\n        {...(installations.length > 0\n          ? { onCancel: () => navigate({ type: 'dashboard' }) }\n          : {})}\n        onSelect={(intent) =>\n          navigate(\n            intent === 'manage' ? { type: 'dashboard' } : { type: 'setup', intent }\n          )\n        }\n      />\n    );\n  }\n\n  if (route.type === 'dashboard') {\n    return (\n      <AutomationDashboardScreen\n"""
replacement = """  const selectIntent = (intent: SetupIntent) => {\n    if (intent === 'manage') {\n      if (installations.length > 0) {\n        navigate({ type: 'dashboard' });\n      }\n      return;\n    }\n    navigate({ type: 'setup', intent });\n  };\n\n  if (route.type === 'intent') {\n    return (\n      <SetupIntentScreen\n        {...(installations.length > 0\n          ? { onCancel: () => navigate({ type: 'dashboard' }) }\n          : {})}\n        showManage={installations.length > 0}\n        onSelect={selectIntent}\n      />\n    );\n  }\n\n  if (route.type === 'dashboard') {\n    if (installations.length === 0) {\n      return <SetupIntentScreen showManage={false} onSelect={selectIntent} />;\n    }\n    return (\n      <AutomationDashboardScreen\n"""
if marker not in text:
    raise SystemExit('routes intent/dashboard marker missing')
text = text.replace(marker, replacement, 1)
routes.write_text(text)

test = Path('apps/mobile/src/__tests__/app-routes.test.tsx')
text = test.read_text()
old = """  it('returns from an empty Android management dashboard to the goal', async () => {\n    nativeAppMocks.getPlatform.mockReturnValue('android');\n    renderRoutes();\n    await waitFor(() => expect(nativeAppMocks.addListener).toHaveBeenCalledTimes(1));\n\n    fireEvent.click(\n      screen.getByRole('button', { name: /Zarządzać istniejącą automatyką/ })\n    );\n    expect(screen.getByText('Nie masz jeszcze zapisanej automatyki')).toBeVisible();\n\n    act(() => nativeAppMocks.fireBack());\n    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();\n    expect(nativeAppMocks.exitApp).not.toHaveBeenCalled();\n  });\n"""
new = """  it('keeps zero-installation Android state on the canonical goal screen', async () => {\n    nativeAppMocks.getPlatform.mockReturnValue('android');\n    renderRoutes();\n    await waitFor(() => expect(nativeAppMocks.addListener).toHaveBeenCalledTimes(1));\n\n    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();\n    expect(\n      screen.queryByRole('button', { name: /Zarządzać istniejącą automatyką/ })\n    ).toBeNull();\n    expect(screen.queryByText('Nie masz jeszcze zapisanej automatyki')).toBeNull();\n  });\n"""
if old not in text:
    raise SystemExit('android zero-state test marker missing')
text = text.replace(old, new, 1)
old = """  it('starts from the user goal instead of technical setup tabs', () => {\n    renderRoutes();\n\n    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();\n    expect(screen.getByRole('button', { name: /Sterować temperaturą/ })).toBeVisible();\n    expect(screen.getByRole('button', { name: /Sterować wilgotnością/ })).toBeVisible();\n    expect(screen.getByRole('button', { name: /Sterować według czasu/ })).toBeVisible();\n    expect(\n      screen.getByRole('button', { name: /Zarządzać istniejącą automatyką/ })\n    ).toBeVisible();\n  });\n"""
new = """  it('starts from the user goal instead of technical setup tabs', () => {\n    renderRoutes();\n\n    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();\n    expect(screen.getByRole('button', { name: /Sterować temperaturą/ })).toBeVisible();\n    expect(screen.getByRole('button', { name: /Sterować wilgotnością/ })).toBeVisible();\n    expect(screen.getByRole('button', { name: /Sterować według czasu/ })).toBeVisible();\n    expect(\n      screen.queryByRole('button', { name: /Zarządzać istniejącą automatyką/ })\n    ).toBeNull();\n  });\n"""
if old not in text:
    raise SystemExit('intent start test marker missing')
text = text.replace(old, new, 1)
old = """  it('opens the management dashboard from the user goal', () => {\n    renderRoutes();\n\n    fireEvent.click(\n      screen.getByRole('button', { name: /Zarządzać istniejącą automatyką/ })\n    );\n\n    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();\n    expect(screen.getByText('Nie masz jeszcze zapisanej automatyki')).toBeVisible();\n  });\n"""
new = """  it('shows management only when an installation exists', () => {\n    const config = createDefaultShellyThermostatConfig(\n      'xiaomi_lywsd03mmc_bthome_v2',\n      'heating'\n    );\n    useInstalledAutomationStore.getState().upsertInstallation(\n      createInstalledAutomation({\n        shelly: { id: 'shellyplugsg3-manage', model: 'S3PL-00112EU', gen: 3 },\n        shellyName: 'Salon',\n        baseUrl: 'http://192.168.0.20/',\n        scriptId: 1,\n        scriptHash: 'lcl-manage',\n        config,\n        nowMs: 1000\n      })\n    );\n\n    renderRoutes();\n    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));\n    fireEvent.click(\n      screen.getByRole('button', { name: /Zarządzać istniejącą automatyką/ })\n    );\n\n    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();\n  });\n"""
if old not in text:
    raise SystemExit('manage route test marker missing')
text = text.replace(old, new, 1)
test.write_text(text)

print('zero-installation routing patch applied')
