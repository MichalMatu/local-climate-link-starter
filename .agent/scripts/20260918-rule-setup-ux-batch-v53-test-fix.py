from pathlib import Path
import re

path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = path.read_text()
pattern = re.compile(
    r"\s*expect\(\s*screen\.getAllByRole\('button', \{ name: /VPD assist/ \}\)\.length\s*\)\.toBeGreaterThanOrEqual\(1\);"
)
replacement = """
      const vpdSection = screen
        .getByText('VPD assist', { selector: 'strong' })
        .closest('section');
      expect(vpdSection).not.toBeNull();
      expect(within(vpdSection as HTMLElement).getByRole('button')).toBeInTheDocument();"""
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f'Expected one stale VPD info assertion, replaced {count}')
path.write_text(text)
print('Updated VPD info assertion to match accessible UI structure')
