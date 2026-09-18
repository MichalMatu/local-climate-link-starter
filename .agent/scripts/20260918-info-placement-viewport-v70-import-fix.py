from pathlib import Path

path = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
text = path.read_text()
old = "import { InfoPopover, Modal, ToastViewport } from '@lcl/ui';"
new = "import { Modal, ToastViewport } from '@lcl/ui';"
if text.count(old) != 1:
    raise SystemExit(f'expected one ShellySetupPage InfoPopover import, found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
print('Removed migrated ShellySetupPage InfoPopover import')
