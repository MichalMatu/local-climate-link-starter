from pathlib import Path

path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = path.read_text()

old_first = '''    expect(screen.getByText('Zaawansowane', { selector: 'summary' })).toBeVisible();
    expect(
      screen.getByText('Narzędzia deweloperskie', { selector: 'summary' })
    ).toBeVisible();
    expect(
      screen
        .getByText('Narzędzia deweloperskie', { selector: 'summary' })
        .closest('details')
    ).not.toHaveAttribute('open');
'''
new_first = '''    expect(screen.getByText('Zaawansowane', { selector: 'summary' })).toBeVisible();
    openRuleDeveloperTools();
    expect(
      screen.queryByText('Narzędzia deweloperskie', { selector: 'summary' })
    ).not.toBeInTheDocument();
'''
if old_first not in text:
    raise SystemExit('first developer disclosure test anchor not found')
text = text.replace(old_first, new_first, 1)

old_second = '''    expect(screen.getByText('Zaawansowane', { selector: 'summary' })).toBeVisible();
    expect(
      screen.getByText('Narzędzia deweloperskie', { selector: 'summary' })
    ).toBeVisible();
    expect(screen.getByLabelText('VPD assist')).not.toBeChecked();
'''
new_second = '''    expect(screen.getByText('Zaawansowane', { selector: 'summary' })).toBeVisible();
    openRuleDeveloperTools();
    expect(
      screen.queryByText('Narzędzia deweloperskie', { selector: 'summary' })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('VPD assist')).not.toBeChecked();
'''
if old_second not in text:
    raise SystemExit('second developer disclosure test anchor not found')
text = text.replace(old_second, new_second, 1)

path.write_text(text)
print('Updated legacy developer disclosure expectations for flat actions')
