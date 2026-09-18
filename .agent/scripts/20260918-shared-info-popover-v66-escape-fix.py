from pathlib import Path

# Keep Escape handling on the same document-level event surface as outside/focus handling.
component = Path('packages/ui/src/feedback/InfoPopover.tsx')
text = component.read_text()
old = """    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focusin', handleFocusIn);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('keydown', handleKeyDown);
    };
"""
new = """    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('keydown', handleKeyDown);
    };
"""
if text.count(old) != 1:
    raise SystemExit(f'expected one InfoPopover listener block, found {text.count(old)}')
component.write_text(text.replace(old, new, 1))

# Test the same document-level keyboard contract.
test = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = test.read_text()
old = "fireEvent.keyDown(window, { key: 'Escape' });"
new = "fireEvent.keyDown(document, { key: 'Escape' });"
if text.count(old) != 1:
    raise SystemExit(f'expected one window Escape dispatch, found {text.count(old)}')
test.write_text(text.replace(old, new, 1))

print('Moved InfoPopover Escape handling to document-level keyboard events')
