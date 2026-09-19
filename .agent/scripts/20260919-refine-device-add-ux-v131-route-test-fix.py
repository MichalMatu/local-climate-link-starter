from pathlib import Path

path = Path('apps/mobile/src/__tests__/app-routes.test.tsx')
text = path.read_text(encoding='utf-8')
old_props = """    plugAddOnly,\n    onPlugAddComplete,\n    onPlugAddCancel\n  }: {\n    setupIntent?: SetupIntent;\n    fixedShellyId?: string;\n    onBackToIntent?: () => void;\n    onSetupComplete?: () => void;\n    plugAddOnly?: boolean;\n    onPlugAddComplete?: () => void;\n    onPlugAddCancel?: () => void;\n  }) => ("""
new_props = """    plugAddOnly\n  }: {\n    setupIntent?: SetupIntent;\n    fixedShellyId?: string;\n    onBackToIntent?: () => void;\n    onSetupComplete?: () => void;\n    plugAddOnly?: boolean;\n  }) => ("""
if old_props not in text:
    raise SystemExit('stale add-plug mock props block not found')
text = text.replace(old_props, new_props, 1)
old_buttons = """      <button type=\"button\" onClick={onPlugAddComplete}>\n        mock-plug-add-complete\n      </button>\n      <button type=\"button\" onClick={onPlugAddCancel}>\n        mock-plug-add-cancel\n      </button>\n"""
if old_buttons not in text:
    raise SystemExit('stale add-plug mock buttons not found')
text = text.replace(old_buttons, '', 1)
old_return = """    fireEvent.click(screen.getByRole('button', { name: 'mock-plug-add-cancel' }));\n    expect(screen.getByRole('main', { name: 'Gniazdka' })).toBeVisible();"""
new_return = """    fireEvent.click(screen.getByRole('button', { name: 'Gniazdka' }));\n    expect(screen.getByRole('main', { name: 'Gniazdka' })).toBeVisible();"""
if old_return not in text:
    raise SystemExit('stale add-plug cancel navigation assertion not found')
text = text.replace(old_return, new_return, 1)
path.write_text(text, encoding='utf-8')
print('Aligned AppRoutes Add Plug test with persistent bottom navigation')
