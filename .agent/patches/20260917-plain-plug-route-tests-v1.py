from pathlib import Path

path = Path('apps/mobile/src/__tests__/app-routes.test.tsx')
text = path.read_text()
old_import = "import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';"
new_import = "import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';"
if old_import not in text:
    raise SystemExit('testing-library import anchor missing')
text = text.replace(old_import, new_import, 1)
old = "fireEvent.click((card as HTMLElement).querySelector('button') as HTMLButtonElement);"
new = "fireEvent.click(\n      within(card as HTMLElement).getByRole('button', { name: 'Dodaj automatykę' })\n    );"
count = text.count(old)
if count != 3:
    raise SystemExit(f'expected 3 implicit card button clicks, found {count}')
path.write_text(text.replace(old, new))
