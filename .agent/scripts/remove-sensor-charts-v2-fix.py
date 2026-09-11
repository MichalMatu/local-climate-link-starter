from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)

# The TP357 test used to assert absence of a Xiaomi-only history button.
# Once history UI is removed globally, the negative assertion is dead contract.
test_path = 'apps/mobile/src/__tests__/hardware-setup.test.tsx'
test = read(test_path)
test, count = re.subn(
    r"\n    expect\(\n      within\(tp357SettingsDialog\)\.queryByRole\('button', \{ name: 'Pobierz historię' \}\)\n    \)\.not\.toBeInTheDocument\(\);",
    '',
    test,
    count=1
)
if count != 1:
    raise SystemExit(f'hardware-setup.test.tsx: expected TP357 history negative assertion once, got {count}')
if 'Pobierz historię' in test:
    raise SystemExit('hardware-setup.test.tsx: history label still remains')
write(test_path, test)

# Some locales had pvvxMobileOnly split across two lines. The first patch replaces
# the key line; remove the now-orphaned old continuation string directly after it.
for path in Path('apps/mobile/src/app/locales').glob('*.ts'):
    lines = read(str(path)).splitlines()
    fixed = []
    for line in lines:
        if (
            fixed
            and 'pvvxMobileOnly:' in fixed[-1]
            and line.strip().startswith("'")
            and line.strip().endswith("',")
        ):
            continue
        fixed.append(line)
    write(str(path), '\n'.join(fixed) + '\n')

print('REMOVE_SENSOR_CHARTS_V2_FIX_OK=1')
