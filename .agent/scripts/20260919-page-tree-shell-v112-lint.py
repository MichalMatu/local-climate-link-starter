from pathlib import Path

settings = Path('apps/mobile/src/app/AppSettingsScreen.tsx')
source = settings.read_text()
anchor = "export const AppSettingsScreen = (_props: AppSettingsScreenProps = {}) => {\n  const { locale, t } = useTranslation();"
replacement = "export const AppSettingsScreen = (_props: AppSettingsScreenProps = {}) => {\n  void _props;\n  const { locale, t } = useTranslation();"
if anchor not in source:
    raise SystemExit('settings props anchor missing')
settings.write_text(source.replace(anchor, replacement, 1))

test = Path('apps/mobile/src/__tests__/automation-detail.test.tsx')
source = test.read_text()
old = "    const { onBack, onNavigateDashboard, onOpenSettings } = renderDetail(saved.id);\n"
if old not in source:
    raise SystemExit('unused detail callbacks anchor missing')
test.write_text(source.replace(old, "    renderDetail(saved.id);\n", 1))
print('Fixed lint leftovers')
