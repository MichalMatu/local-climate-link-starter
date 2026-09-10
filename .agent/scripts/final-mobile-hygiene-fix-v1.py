from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, got {count}')
    return text.replace(old, new, 1)

# Shelly setup: replace hand-authored action SVGs with Tabler and tokenized compact action class.
p = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
s = p.read_text()
s = replace_once(
    s,
    "import type { ShellyClockStatus, ShellyComponentState } from '@lcl/shelly-client';\nimport { useCallback, useEffect, useId, useRef, useState } from 'react';",
    "import type { ShellyClockStatus, ShellyComponentState } from '@lcl/shelly-client';\nimport { IconBluetooth, IconRefresh, IconSettings, IconTrash } from '@tabler/icons-react';\nimport { useCallback, useEffect, useId, useRef, useState } from 'react';",
    'shelly tabler import'
)
start = s.index("type ActionIconName = 'refresh' | 'bluetooth' | 'trash' | 'settings';")
end = s.index('const SavedShellyDeviceCard =', start)
s = s[:start] + s[end:]
replacements = {
    '<ActionIcon name="settings" />': '<IconSettings className="icon-action__svg" aria-hidden="true" />',
    '<ActionIcon name="refresh" />': '<IconRefresh className="icon-action__svg" aria-hidden="true" />',
    '<ActionIcon name="bluetooth" />': '<IconBluetooth className="icon-action__svg" aria-hidden="true" />',
    '<ActionIcon name="trash" />': '<IconTrash className="icon-action__svg" aria-hidden="true" />',
}
for old, new in replacements.items():
    if old not in s:
        raise SystemExit(f'missing Shelly icon use: {old}')
    s = s.replace(old, new)
old = """          <button
            className="secondary-action"
            type="button"
            disabled={isAnyShellyCheckPending}
            title={t('hardware.shelly.networkScanTitle')}
            onClick={openScanModalFromAdd}
            style={{ fontSize: '0.8em', padding: '0 8px', minHeight: '28px' }}
          >"""
new = """          <button
            className="secondary-action modal-header-action--compact"
            type="button"
            disabled={isAnyShellyCheckPending}
            title={t('hardware.shelly.networkScanTitle')}
            onClick={openScanModalFromAdd}
          >"""
s = replace_once(s, old, new, 'Shelly compact modal action')
p.write_text(s)

# Sensor setup: real Tabler Settings icon + same tokenized compact modal action.
p = Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx')
s = p.read_text()
s = replace_once(
    s,
    "import { useCallback, useEffect, useId, useRef, useState } from 'react';\nimport { useTranslation } from '../../../app/i18n.js';\nimport { SettingsGearIcon } from '../../../components/icons/SettingsGearIcon.js';",
    "import { IconSettings } from '@tabler/icons-react';\nimport { useCallback, useEffect, useId, useRef, useState } from 'react';\nimport { useTranslation } from '../../../app/i18n.js';",
    'sensor tabler import'
)
s = replace_once(
    s,
    '<SettingsGearIcon />',
    '<IconSettings className="icon-action__svg" aria-hidden="true" />',
    'sensor settings icon'
)
old = """          <button
            className="secondary-action"
            type="button"
            disabled={isPhoneBleScanPending}
            title={t('hardware.sensor.scanPhoneTitle')}
            onClick={openPhoneBleScanModal}
            style={{ fontSize: '0.8em', padding: '0 8px', minHeight: '28px' }}
          >"""
new = """          <button
            className="secondary-action modal-header-action--compact"
            type="button"
            disabled={isPhoneBleScanPending}
            title={t('hardware.sensor.scanPhoneTitle')}
            onClick={openPhoneBleScanModal}
          >"""
s = replace_once(s, old, new, 'Sensor compact modal action')
p.write_text(s)

# Rule setup: replace hand-authored trash SVG with Tabler.
p = Path('apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx')
s = p.read_text()
s = replace_once(
    s,
    "import type { ThresholdDirection, RulePresetId } from '@lcl/automation-core';\nimport { useCallback, useEffect, useId, useRef, useState } from 'react';",
    "import type { ThresholdDirection, RulePresetId } from '@lcl/automation-core';\nimport { IconTrash } from '@tabler/icons-react';\nimport { useCallback, useEffect, useId, useRef, useState } from 'react';",
    'rule tabler import'
)
start = s.index('const TrashIcon = () => (')
end_marker = 'const createAdvancedDraft ='
end = s.index(end_marker, start)
s = s[:start] + s[end:]
if '<TrashIcon />' not in s:
    raise SystemExit('rule TrashIcon use missing')
s = s.replace('<TrashIcon />', '<IconTrash className="icon-action__svg" aria-hidden="true" />')
p.write_text(s)

# Delete obsolete raw SVG wrapper after all callers moved to Tabler.
gear = Path('apps/mobile/src/components/icons/SettingsGearIcon.tsx')
if not gear.exists():
    raise SystemExit('SettingsGearIcon source missing')
gear.unlink()

# Shared compact modal-header action style using existing LCL tokens only.
p = Path('apps/mobile/src/theme/theme.css')
s = p.read_text()
anchor = """.primary-action:hover {
  background: var(--lcl-color-accent-strong);
}
"""
addition = """
.modal-header-action--compact {
  font-size: var(--lcl-font-size-sm);
  min-height: var(--lcl-size-compact-control-min-height);
  padding-inline: var(--lcl-spacing-sm);
}
"""
if addition.strip() in s:
    raise SystemExit('compact modal action style already present')
s = replace_once(s, anchor, anchor + addition, 'theme compact action anchor')
p.write_text(s)

# Extend UX gate so raw mobile SVG and inline style literals cannot quietly return.
p = Path('scripts/quality/ux-gate.mjs')
s = p.read_text()
anchor = """const checkPackageRuntimeCopy = async () => {
"""
function = """const checkMobileProductionMarkupHygiene = async () => {
  const paths = (await listRepoFiles('apps/mobile/src')).filter(
    (path) =>
      path.endsWith('.tsx') &&
      !path.includes('/__tests__/') &&
      !/\\.(?:test|spec)\\.tsx$/.test(path)
  );

  for (const path of paths) {
    const source = await readRepoFile(path);
    if (source.includes('<svg')) {
      addFailure(path, 'production mobile icons must use Tabler/shared components, not hand-authored SVG');
    }
    if (/style=\\{\\{/.test(source)) {
      addFailure(path, 'production mobile layout/style must use tokenized CSS classes, not inline style objects');
    }
  }
};

"""
s = replace_once(s, anchor, function + anchor, 'UX hygiene function anchor')
call_anchor = """await checkThemeTokenPatterns();
await checkPackageRuntimeCopy();
"""
s = replace_once(
    s,
    call_anchor,
    """await checkThemeTokenPatterns();
await checkMobileProductionMarkupHygiene();
await checkPackageRuntimeCopy();
""",
    'UX hygiene call anchor'
)
p.write_text(s)

print('final mobile hygiene fix applied')
