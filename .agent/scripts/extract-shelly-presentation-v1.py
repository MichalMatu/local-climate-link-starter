from pathlib import Path

page_path = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
presentation_path = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx')
gate_path = Path('scripts/quality/ux-gate.mjs')

page = page_path.read_text()
assert not presentation_path.exists(), presentation_path
assert "const formatNullableMetric =" in page
assert "export const ShellySetupPage" in page

start = page.index('const formatNullableMetric =')
end = page.index('export const ShellySetupPage')
block = page[start:end]

for source, target in {
    'const formatNullableMetric =': 'export const formatNullableMetric =',
    'const formatComponentState =': 'export const formatComponentState =',
    'const shellyCompatibilityBadge =': 'export const shellyCompatibilityBadge =',
    'const formatPlugPower =': 'export const formatPlugPower =',
    'const formatPlugVoltage =': 'export const formatPlugVoltage =',
    'const formatPlugEnergy =': 'export const formatPlugEnergy =',
    'const formatShellyClock =': 'export const formatShellyClock =',
    'const formatClockSyncState =': 'export const formatClockSyncState =',
    'const formatAutomationMode =': 'export const formatAutomationMode =',
    'const formatBleCandidateProfile =': 'export const formatBleCandidateProfile =',
    'const formatClockUptime =': 'export const formatClockUptime =',
    'const formatClockTimestamp =': 'export const formatClockTimestamp =',
    'const formatShellyScanEstimate =': 'export const formatShellyScanEstimate =',
    'const ShellyAddForm =': 'export const ShellyAddForm =',
    'const SavedShellyDeviceCard =': 'export const SavedShellyDeviceCard =',
}.items():
    assert source in block, source
    block = block.replace(source, target, 1)

presentation = """import type { ShellyClockStatus, ShellyComponentState } from '@lcl/shelly-client';
import { IconRefresh, IconSettings } from '@tabler/icons-react';
import { useId } from 'react';
import {
  useTranslation,
  type Locale,
  type Translate,
  type TranslationKey
} from '../../../app/i18n.js';
import type { BleDiscoveryCandidate } from '../../../flows/hardware-setup/schemas.js';
import {
  SHELLY_SETUP_SCAN_CONCURRENCY,
  SHELLY_SETUP_SCAN_RPC_TIMEOUT_MS
} from '../../../flows/hardware-setup/shellyRequests.js';
import type { ShellyDraftDevice } from '../../../flows/hardware-setup/setupDraftStore.js';
import { countIpv4RangeScanAddresses } from '../../../flows/hardware-setup/validation.js';
import type { HardwarePageProps } from '../helpers.js';

""" + block
presentation_path.write_text(presentation)

page = page[:start] + page[end:]
page = page.replace(
    "import type { ShellyClockStatus, ShellyComponentState } from '@lcl/shelly-client';\n",
    ''
)
page = page.replace(
    "import { IconBluetooth, IconRefresh, IconSettings, IconTrash } from '@tabler/icons-react';",
    "import { IconBluetooth, IconTrash } from '@tabler/icons-react';"
)
page = page.replace(
    "import {\n  useTranslation,\n  type Locale,\n  type Translate,\n  type TranslationKey\n} from '../../../app/i18n.js';",
    "import { useTranslation } from '../../../app/i18n.js';"
)
page = page.replace(
    "import {\n  SHELLY_SETUP_SCAN_CONCURRENCY,\n  SHELLY_SETUP_SCAN_RPC_TIMEOUT_MS,\n  type ShellySetupScanResult\n} from '../../../flows/hardware-setup/shellyRequests.js';",
    "import type { ShellySetupScanResult } from '../../../flows/hardware-setup/shellyRequests.js';"
)
anchor = "import type { ShellyDraftDevice } from '../../../flows/hardware-setup/setupDraftStore.js';\n"
assert anchor in page
page = page.replace(
    anchor,
    anchor
    + "import {\n"
    + "  formatAutomationMode,\n"
    + "  formatBleCandidateProfile,\n"
    + "  formatClockSyncState,\n"
    + "  formatClockTimestamp,\n"
    + "  formatClockUptime,\n"
    + "  formatComponentState,\n"
    + "  formatNullableMetric,\n"
    + "  formatPlugEnergy,\n"
    + "  formatPlugPower,\n"
    + "  formatPlugVoltage,\n"
    + "  formatShellyClock,\n"
    + "  formatShellyScanEstimate,\n"
    + "  SavedShellyDeviceCard,\n"
    + "  ShellyAddForm,\n"
    + "  shellyCompatibilityBadge\n"
    + "} from './ShellySetupPresentation.js';\n",
    1
)
page_path.write_text(page)

gate = gate_path.read_text()
old_path = "const path = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx';"
new_path = "const path = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx';"
assert old_path in gate
gate = gate.replace(old_path, new_path, 1)
gate = gate.replace(
    "const start = source.indexOf('const SavedShellyDeviceCard =');\n  const end = source.indexOf('export const ShellySetupPage');",
    "const start = source.indexOf('export const SavedShellyDeviceCard =');\n  const end = source.length;",
    1
)
gate_path.write_text(gate)

print('Shelly setup presentation extracted')
