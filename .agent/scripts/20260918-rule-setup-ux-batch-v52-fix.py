from pathlib import Path

rule_path = Path('apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx')
text = rule_path.read_text()
old_import = "import { RULE_ADVANCED_LIMITS } from '../../../flows/hardware-setup/ruleAdvancedSettings.js';\n"
new_import = """import {
  DEFAULT_RULE_ADVANCED_SETTINGS,
  RULE_ADVANCED_LIMITS
} from '../../../flows/hardware-setup/ruleAdvancedSettings.js';
"""
if old_import not in text:
    raise SystemExit('Expected post-extraction advanced import not found')
text = text.replace(old_import, new_import, 1)
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
    raise SystemExit('Expected first legacy advanced-modal test block not found')
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
new = """    expect(within(advancedSection).getByLabelText('Minimalny RSSI dBm')).toHaveValue(-85);
    expect(within(advancedSection).getByLabelText('Brak odczytu przez min')).toHaveValue(2);
    expect(within(advancedSection).getByLabelText('Ponowne ON po min')).toHaveValue(2);
    expect(within(advancedSection).getByLabelText('Maksymalny czas pracy h')).toHaveValue(4);
"""
if old not in text:
    raise SystemExit('Expected loaded advanced-modal test block not found')
text = text.replace(old, new, 1)

if 'openRuleAdvancedDialog' in text:
    raise SystemExit('Legacy openRuleAdvancedDialog reference remains')

test_path.write_text(text)
print('Applied deterministic v52 rule UX retry fix')
