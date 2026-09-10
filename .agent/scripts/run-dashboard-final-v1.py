from pathlib import Path
import subprocess
import sys

if len(sys.argv) != 2:
    raise SystemExit('usage: run-dashboard-final-v1.py <patch-script>')

patch_script = Path(sys.argv[1])
text = patch_script.read_text()
needle = """def replace_exact(path: str, old: str, new: str, count: int = 1) -> None:\n    p = ROOT / path\n    text = p.read_text()\n"""
replacement = """def replace_exact(path: str, old: str, new: str, count: int = 1) -> None:\n    old = old.replace('\\\\n', '\\n')\n    new = new.replace('\\\\n', '\\n')\n    p = ROOT / path\n    text = p.read_text()\n"""
if text.count(needle) != 1:
    raise SystemExit('dashboard patch helper shape changed')
patch_script.write_text(text.replace(needle, replacement))
subprocess.run([sys.executable, str(patch_script)], check=True)

# Two hook replacements in v1 intentionally use escaped newlines inside generated
# Python strings. Normalize only those small TypeScript files after the patch.
for hook in [
    Path('apps/mobile/src/flows/installations/useInstalledAutomationRuntime.ts'),
    Path('apps/mobile/src/flows/time-automation/useTimeAutomationRuntime.ts'),
]:
    hook_text = hook.read_text()
    hook.write_text(hook_text.replace('\\n', '\n'))

print('dashboard final v1 runner completed')
