from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"Expected exactly one match in {path}, found {text.count(old)}")
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    "packages/ui/src/primitives/SelectField.tsx",
    """        <span\n          className={\n            selectedOption\n              ? 'lcl-select-field__value'\n              : 'lcl-select-field__value lcl-select-field__value--placeholder'\n          }\n        >\n          {selectedOption?.label ?? placeholder ?? ''}\n        </span>\n        <span className=\"lcl-select-field__chevron\" aria-hidden=\"true\">\n          ▾\n        </span>\n""",
    """        <span className=\"lcl-select-field__trigger-content\">\n          <span\n            className={\n              selectedOption\n                ? 'lcl-select-field__value'\n                : 'lcl-select-field__value lcl-select-field__value--placeholder'\n            }\n          >\n            {selectedOption?.label ?? placeholder ?? ''}\n          </span>\n          {selectedOption?.meta ? (\n            <span className=\"lcl-select-field__trigger-meta\">\n              {selectedOption.meta}\n            </span>\n          ) : null}\n        </span>\n        <span className=\"lcl-select-field__chevron\" aria-hidden=\"true\">\n          ▾\n        </span>\n""",
)

replace_once(
    "packages/ui/src/primitives/SelectField.css",
    """.lcl-select-field__trigger:disabled {\n  cursor: not-allowed;\n  opacity: var(--lcl-opacity-disabled);\n}\n\n.lcl-select-field__value {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n""",
    """.lcl-select-field__trigger:disabled {\n  cursor: not-allowed;\n  opacity: var(--lcl-opacity-disabled);\n}\n\n.lcl-select-field__trigger-content {\n  align-items: center;\n  display: flex;\n  flex: 1 1 auto;\n  gap: var(--lcl-spacing-sm);\n  justify-content: space-between;\n  min-width: 0;\n}\n\n.lcl-select-field__value {\n  flex: 1 1 auto;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.lcl-select-field__trigger-meta {\n  flex: 0 0 auto;\n  margin-left: auto;\n  min-width: 0;\n  white-space: nowrap;\n}\n""",
)

replace_once(
    "apps/mobile/src/__tests__/hardware-setup.test.tsx",
    """    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));\n    await waitFor(() => expect(phoneBleScannerMock.startCount).toBeGreaterThanOrEqual(1));\n    fireEvent.click(screen.getByRole('button', { name: 'Termometr' }));\n\n    const option = await screen.findByRole('option', { name: 'Xiaomi salon' });\n""",
    """    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));\n    await waitFor(() => expect(phoneBleScannerMock.startCount).toBeGreaterThanOrEqual(1));\n\n    const thermometerSelect = screen.getByRole('button', { name: 'Termometr' });\n    await waitFor(() => expect(thermometerSelect).toHaveTextContent('21.3°C · 45.7%'));\n    expect(thermometerSelect).not.toHaveTextContent('kPa');\n    expect(thermometerSelect.querySelector('.lcl-select-field__trigger-meta')).not.toBeNull();\n    expect(thermometerSelect.querySelector('.tabler-icon-device-mobile')).not.toBeNull();\n    fireEvent.click(thermometerSelect);\n\n    const option = await screen.findByRole('option', { name: 'Xiaomi salon' });\n""",
)

print("Selected option meta now renders in the closed SelectField trigger")
