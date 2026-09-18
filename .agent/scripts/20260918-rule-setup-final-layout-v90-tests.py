from pathlib import Path

path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = path.read_text()

old_closed = '''    expect(
      screen
        .getByText('Narzędzia deweloperskie', { selector: 'summary' })
        .closest('details')
    ).not.toHaveAttribute('open');
    expect(
      screen.queryByRole('dialog', { name: 'Podgląd Shelly Script' })
    ).not.toBeInTheDocument();
'''
new_closed = '''    expect(
      screen.queryByText('Narzędzia deweloperskie', { selector: 'summary' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Podgląd Shelly Script' })
    ).not.toBeInTheDocument();
'''
if old_closed not in text:
    raise SystemExit('legacy closed developer disclosure assertion not found')
text = text.replace(old_closed, new_closed, 1)

old_container = '''    const developerTools = screen
      .getByText('Narzędzia deweloperskie', { selector: 'summary' })
      .closest('details');
    expect(developerTools).not.toBeNull();
    const developerActions = developerTools!.querySelector('.rule-developer-actions');
    expect(developerActions).toHaveClass('rule-developer-actions--compact');
    expect(within(developerActions as HTMLElement).getAllByRole('button')).toHaveLength(
      2
    );
'''
new_container = '''    const developerActions = document.querySelector('.rule-developer-actions--compact');
    expect(developerActions).not.toBeNull();
    expect(developerActions).toHaveClass('rule-developer-actions');
    expect(within(developerActions as HTMLElement).getAllByRole('button')).toHaveLength(
      2
    );
'''
if old_container not in text:
    raise SystemExit('legacy developer details container assertion not found')
text = text.replace(old_container, new_container, 1)

path.write_text(text)
print('Finished flat developer action test migration')
