from pathlib import Path

path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = path.read_text()
old = """    fireEvent.keyDown(window, { key: 'Escape' });
    expect(tooltipButton).toHaveAttribute('aria-expanded', 'false');
    expect(
      within(dialog).queryByRole('tooltip', { name: 'Skanowanie Shelly' })
    ).not.toBeInTheDocument();
"""
new = """    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(tooltipButton).toHaveAttribute('aria-expanded', 'false'));
    await waitFor(() =>
      expect(
        within(dialog).queryByRole('tooltip', { name: 'Skanowanie Shelly' })
      ).not.toBeInTheDocument()
    );
"""
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected one Escape assertion block, found {count}')
path.write_text(text.replace(old, new, 1))
print('Made InfoPopover Escape assertions wait for React state commit')
