from pathlib import Path

p = Path('apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx')
s = p.read_text()

for old in [
    "import { Capacitor } from '@capacitor/core';\n",
    "import mobilePackage from '../../../../package.json';\n",
    "import {\n  AppSettingsModal,\n  type SupportDiagnosticRow\n} from '../../../app/AppSettingsModal.js';\n",
    "import { SettingsGearIcon } from '../../../components/icons/SettingsGearIcon.js';\n",
    "import { getRuntimeIssues } from '../../../app/runtimeDiagnostics.js';\n",
    "import { type SupportReportDevice } from '../../../app/supportReport.js';\n",
]:
    if old not in s:
        raise SystemExit(f'missing import anchor: {old!r}')
    s = s.replace(old, '', 1)

helper_start = s.find('const createSupportReportDevice = (')
helper_end = s.find('\n\nconst diagnosticReasonKeys', helper_start)
if helper_start < 0 or helper_end < 0:
    raise SystemExit('support report helper block missing')
s = s[:helper_start] + s[helper_end + 2:]

state_line = '  const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false);\n'
if s.count(state_line) != 1:
    raise SystemExit(f'unexpected settings state count: {s.count(state_line)}')
s = s.replace(state_line, '', 1)

runtime_line = '  const runtimeIssues = getRuntimeIssues();\n\n'
if s.count(runtime_line) != 1:
    raise SystemExit(f'unexpected runtime issues anchor count: {s.count(runtime_line)}')
s = s.replace(runtime_line, '', 1)

support_start = s.find('  const supportRows: SupportDiagnosticRow[] = [')
support_end = s.find('  const dismissToast = useCallback', support_start)
if support_start < 0 or support_end < 0:
    raise SystemExit('support modal data block missing')
s = s[:support_start] + s[support_end:]

button_block = '''      <div className="action-row diagnostics-settings-row">
        <button
          className="secondary-action diagnostics-settings-button"
          type="button"
          aria-label={t('settings.open')}
          title={t('settings.open')}
          onClick={() => setIsAppSettingsOpen(true)}
        >
          <SettingsGearIcon />
          {t('settings.open')}
        </button>
      </div>

'''
if s.count(button_block) != 1:
    raise SystemExit(f'unexpected diagnostics settings button count: {s.count(button_block)}')
s = s.replace(button_block, '', 1)

modal_start = s.find('      <AppSettingsModal\n')
modal_end = s.find('      />\n', modal_start)
if modal_start < 0 or modal_end < 0:
    raise SystemExit('diagnostics settings modal block missing')
s = s[:modal_start] + s[modal_end + len('      />\n'):]

p.write_text(s)
print('diagnostics settings modal dependency removed')
