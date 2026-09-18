from pathlib import Path

root = Path('.')
rule = root / 'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx'
css = root / 'apps/mobile/src/theme/theme.css'
test = root / 'apps/mobile/src/__tests__/hardware-setup.test.tsx'

rule_text = rule.read_text()
old_type = '''    | {\n        temperatureC?: number | undefined;\n        humidityPct?: number | undefined;\n        vpdKpa?: number | undefined;\n      }\n'''
new_type = '''    | {\n        temperatureC?: number | undefined;\n        humidityPct?: number | undefined;\n      }\n'''
assert old_type in rule_text
rule_text = rule_text.replace(old_type, new_type, 1)
old_summary = '''  `${formatCompactSensorMetric(reading?.temperatureC, '°C', 1)} · ${formatCompactSensorMetric(\n    reading?.humidityPct,\n    '%',\n    1\n  )} · ${formatCompactSensorMetric(reading?.vpdKpa, 'kPa', 2)}`;\n'''
new_summary = '''  `${formatCompactSensorMetric(reading?.temperatureC, '°C', 1)} · ${formatCompactSensorMetric(\n    reading?.humidityPct,\n    '%',\n    1\n  )}`;\n'''
assert old_summary in rule_text
rule.write_text(rule_text.replace(old_summary, new_summary, 1))

css_text = css.read_text()
old_css = '''.rule-sensor-option-live {\n  align-items: center;\n  color: var(--lcl-color-text-muted);\n  display: inline-flex;\n  font-size: var(--lcl-font-size-sm);\n'''
new_css = '''.rule-sensor-option-live {\n  align-items: center;\n  color: var(--lcl-color-text-muted);\n  display: inline-flex;\n  font-size: var(--lcl-font-size-xs);\n'''
assert old_css in css_text
css.write_text(css_text.replace(old_css, new_css, 1))

test_text = test.read_text()
old_expect = "expect(option).toHaveTextContent('21.3°C · 45.7% · 1.38kPa');"
new_expect = "expect(option).toHaveTextContent('21.3°C · 45.7%');\n    expect(option).not.toHaveTextContent('kPa');"
assert test_text.count(old_expect) == 1
test_text = test_text.replace(old_expect, new_expect, 1)
old_meta = "expect(metadata).toHaveTextContent('21.3°C · 45.7% · 1.38kPa');"
new_meta = "expect(metadata).toHaveTextContent('21.3°C · 45.7%');\n    expect(metadata).not.toHaveTextContent('kPa');"
assert test_text.count(old_meta) == 1
test.write_text(test_text.replace(old_meta, new_meta, 1))

print('Compacted thermometer picker readings to temperature and humidity')
