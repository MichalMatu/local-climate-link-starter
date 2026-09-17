from pathlib import Path

page = Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx')
source = page.read_text()
if "import { useTranslation } from '../../../app/i18n.js';" not in source:
    needle = "import { useState } from 'react';\n"
    assert needle in source
    source = source.replace(
        needle,
        needle + "import { useTranslation } from '../../../app/i18n.js';\n",
        1,
    )
page.write_text(source)

css = Path('apps/mobile/src/theme/theme.css')
source = css.read_text()
source = source.replace("\n.sensor-setup-panel {\n}\n", "\n")
css.write_text(source)
