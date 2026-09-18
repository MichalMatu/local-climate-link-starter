from pathlib import Path

path = Path('packages/design-tokens/tokens/tokens.json')
text = path.read_text()
old = '  "motion": {\n    "fast": "120ms",\n    "normal": "180ms"\n  },'
new = '  "motion": {\n    "fast": "120ms",\n    "normal": "180ms",\n    "readingPulse": "650ms"\n  },'
if old not in text:
    raise SystemExit('expected motion block not found')
if text.count(old) != 1:
    raise SystemExit(f'expected one motion block, got {text.count(old)}')
path.write_text(text.replace(old, new, 1))
print('Added readingPulse to authoritative design token source')
