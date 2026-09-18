from pathlib import Path

component = Path('packages/ui/src/feedback/InfoPopover.tsx')
text = component.read_text()
old = """    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
"""
new = """    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsOpen(false);
      }
    };
"""
if text.count(old) != 1:
    raise SystemExit(f'expected one InfoPopover Escape handler, found {text.count(old)}')
component.write_text(text.replace(old, new, 1))

test = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = test.read_text()
old = """    await waitFor(() =>
      expect(
        within(dialog).queryByRole('tooltip', { name: 'Skanowanie Shelly' })
      ).not.toBeInTheDocument()
    );
  });
"""
new = """    await waitFor(() =>
      expect(
        within(dialog).queryByRole('tooltip', { name: 'Skanowanie Shelly' })
      ).not.toBeInTheDocument()
    );
    expect(screen.getByRole('dialog', { name: 'Dodaj gniazdko' })).toBe(dialog);
  });
"""
if text.count(old) != 1:
    raise SystemExit(f'expected one Escape close assertion tail, found {text.count(old)}')
test.write_text(text.replace(old, new, 1))

print('Made InfoPopover consume Escape before the containing modal')
