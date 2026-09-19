from pathlib import Path
import re

path = Path('apps/mobile/src/screens/InstallationDiagnosticsModal.tsx')
text = path.read_text()
text, count = re.subn(
    r"\n  const formatUptimeAge = \(valueUptimeMs: number \| null \| undefined\): string => \{.*?\n  \};\n",
    "\n",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit('unused formatUptimeAge block not found')
path.write_text(text)
print('Removed unused modal uptime formatter')
