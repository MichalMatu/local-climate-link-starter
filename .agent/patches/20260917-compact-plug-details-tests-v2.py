from pathlib import Path

path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = path.read_text()
text = text.replace(
    "expect(within(infoDialog).getByText('Przekaźnik')).toBeInTheDocument();",
    "expect(within(infoDialog).queryByText('Przekaźnik')).not.toBeInTheDocument();"
)
text = text.replace(
    "expect(within(infoDialog).getByText('Tryb')).toBeInTheDocument();",
    "expect(within(infoDialog).queryByText('Tryb')).not.toBeInTheDocument();"
)
old = "expect(await within(infoDialog).findByText('zsynchronizowany')).toBeInTheDocument();"
new = """expect(within(infoDialog).getByText('NTP').closest('.lcl-diagnostic-row')).toHaveTextContent(\n      'zsynchronizowany'\n    );"""
if old not in text:
    raise SystemExit('NTP sync assertion anchor missing')
text = text.replace(old, new)
path.write_text(text)
