from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'target not found in {path}: {old[:120]!r}')
    file.write_text(text.replace(old, new, 1))


replace_once(
    'apps/mobile/src/components/AppPageBack.tsx',
    """type AppPageBackProps = {\n  label: string;\n  onBack(): void;\n};\n\nexport const AppPageBack = ({ label, onBack }: AppPageBackProps) => (\n  <div className=\"setup-context app-page-back-row\">\n    <button className=\"setup-context__back\" type=\"button\" onClick={onBack}>\n      ‹ {label}\n    </button>\n  </div>\n);\n""",
    """import type { ReactNode } from 'react';\n\ntype AppPageBackProps = {\n  context?: ReactNode;\n  label: string;\n  onBack(): void;\n};\n\nexport const AppPageBack = ({ context, label, onBack }: AppPageBackProps) => (\n  <div className=\"setup-context app-page-back-row\">\n    <button className=\"setup-context__back\" type=\"button\" onClick={onBack}>\n      ‹ {label}\n    </button>\n    {context !== undefined && <strong>{context}</strong>}\n  </div>\n);\n""",
)

replace_once(
    'apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx',
    """      {setupIntent && onBackToIntent && !plugAddOnly && !sensorAddOnly && (\n        <div className=\"setup-context\">\n          <button className=\"setup-context__back\" type=\"button\" onClick={onBackToIntent}>\n            {t('intent.back')}\n          </button>\n          <strong>{t(`intent.${setupIntent}.context`)}</strong>\n        </div>\n      )}\n""",
    """      {setupIntent && onBackToIntent && !plugAddOnly && !sensorAddOnly && (\n        <AppPageBack\n          context={t(`intent.${setupIntent}.context`)}\n          label={t('intent.back')}\n          onBack={onBackToIntent}\n        />\n      )}\n""",
)

print('Setup back chrome implementation applied')
