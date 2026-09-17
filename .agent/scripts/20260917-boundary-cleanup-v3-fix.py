from pathlib import Path

p = Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx')
s = p.read_text()
needle = "import { useState } from 'react';\n"
replacement = needle + "import { useTranslation } from '../../../app/i18n.js';\n"
assert needle in s
assert "../../../app/i18n.js" not in s
p.write_text(s.replace(needle, replacement, 1))
