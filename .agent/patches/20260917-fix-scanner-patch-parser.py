from pathlib import Path

path = Path('/tmp/scanner-patch.py')
text = path.read_text()
old = '''def property_pattern(key):
    return re.compile(rf"(?ms)^      {re.escape(key)}:\\s*(?:\\n\\s*)?'(?:\\\\.|[^'])*',")
'''
new = '''def property_pattern(key):
    return re.compile(
        rf"(?ms)^      {re.escape(key)}:\\s*(?:\\n\\s*)?(?:'(?:\\\\.|[^'])*'|\"(?:\\\\.|[^\"])*\"),"
    )
'''
if old not in text:
    raise SystemExit('property_pattern anchor missing')
path.write_text(text.replace(old, new, 1))
