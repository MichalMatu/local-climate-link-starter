from pathlib import Path

rule_path = Path('apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx')
text = rule_path.read_text()
needle = "import {\n  RULE_ADVANCED_LIMITS,"
if needle in text:
    text = text.replace(
        needle,
        "import {\n  DEFAULT_RULE_ADVANCED_SETTINGS,\n  RULE_ADVANCED_LIMITS,",
        1,
    )
elif 'DEFAULT_RULE_ADVANCED_SETTINGS' not in text.split('\n', 40)[0:40]:
    raise SystemExit('Could not restore DEFAULT_RULE_ADVANCED_SETTINGS import')
rule_path.write_text(text)

test_path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = test_path.read_text()

old = """    const advancedDialog = await openRuleAdvancedDialog();
    fireEvent.change(within(advancedDialog).getByLabelText('Minimalny RSSI dBm'), {
      target: { value: '-60' }
    });
    fireEvent.change(within(advancedDialog).getByLabelText('Brak odczytu przez min'), {
      target: { value: '30' }
    });
    fireEvent.change(within(advancedDialog).getByLabelText('Ponowne ON po min'), {
      target: { value: '10' }
    });
    fireEvent.change(within(advancedDialog).getByLabelText('Maksymalny czas pracy h'), {
      target: { value: '8' }
    });
    fireEvent.click(within(advancedDialog).getByRole('button', { name: 'Zastosuj' }));
"""
new = """    const advancedSection = openRuleDisclosure('Zaawansowane');
    fireEvent.change(within(advancedSection).getByLabelText('Minimalny RSSI dBm'), {
      target: { value: '-60' }
    });
    fireEvent.change(within(advancedSection).getByLabelText('Brak odczytu przez min'), {
      target: { value: '30' }
    });
    fireEvent.change(within(advancedSection).getByLabelText('Ponowne ON po min'), {
      target: { value: '10' }
    });
    fireEvent.change(within(advancedSection).getByLabelText('Maksymalny czas pracy h'), {
      target: { value: '8' }
    });
"""
if old not in text:
    raise SystemExit('Could not update first legacy advanced-modal test block')
text = text.replace(old, new, 1)

old = """    const loadedAdvancedDialog = await openRuleAdvancedDialog();
    expect(within(loadedAdvancedDialog).getByLabelText('Minimalny RSSI dBm')).toHaveValue(
      -85
    );
    expect(
      within(loadedAdvancedDialog).getByLabelText('Brak odczytu przez min')
    ).toHaveValue(2);
    expect(within(loadedAdvancedDialog).getByLabelText('Ponowne ON po min')).toHaveValue(
      2
    );
    expect(
      within(loadedAdvancedDialog).getByLabelText('Maksymalny czas pracy h')
    ).toHaveValue(4);
    fireEvent.click(
      within(loadedAdvancedDialog).getByRole('button', { name: 'Zamknij' })
    );
"""
new = """    const loadedAdvancedSection = advancedSection;
    expect(within(loadedAdvancedSection).getByLabelText('Minimalny RSSI dBm')).toHaveValue(
      -85
    );
    expect(
      within(loadedAdvancedSection).getByLabelText('Brak odczytu przez min')
    ).toHaveValue(2);
    expect(within(loadedAdvancedSection).getByLabelText('Ponowne ON po min')).toHaveValue(
      2
    );
    expect(
      within(loadedAdvancedSection).getByLabelText('Maksymalny czas pracy h')
    ).toHaveValue(4);
"""
if old not in text:
    raise SystemExit('Could not update loaded advanced inline test block')
text = text.replace(old, new, 1)

if 'openRuleAdvancedDialog' in text:
    raise SystemExit('Legacy openRuleAdvancedDialog reference remains')

test_path.write_text(text)
print('Fixed v50 typecheck fallout and remaining advanced-modal test references')
