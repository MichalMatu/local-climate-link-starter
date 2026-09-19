from pathlib import Path

path = Path('scripts/quality/ux-gate.mjs')
text = path.read_text()
if '\x08size=' not in text:
    raise SystemExit('Expected backspace regex artifact not found')
text = text.replace('\x08size=', r'\bsize=')
path.write_text(text)
print('Fixed modal size regex word boundary')
