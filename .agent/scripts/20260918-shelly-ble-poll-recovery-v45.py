from pathlib import Path

# Reapply the v44 product/test changes from the clean work branch.
exec(Path('/dev/stdin').read_text()) if False else None

path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = path.read_text()
old = "  it('recovers Shelly BLE polling after one transient refresh failure', async () => {"
new = "  it('recovers Shelly BLE polling after one transient refresh failure', async () => {"
if old not in text:
    raise SystemExit('recovery test declaration not found')
# The task command patches the closing declaration with an explicit timeout after applying v44.
# Do the exact closing replacement around this test only.
start = text.index(old)
next_test = text.index("\n\n  it('keeps BLE scan refresh errors out of the visible UI'", start)
block = text[start:next_test]
if block.rstrip().endswith('});'):
    block = block.rstrip()[:-3] + '}, 12_000);'
else:
    raise SystemExit('recovery test closing not found')
text = text[:start] + block + text[next_test:]
path.write_text(text)
