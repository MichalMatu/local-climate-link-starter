import type { RuleSetupFlow } from '../pageContracts.js';
import {
  FeedbackPanel,
  InfoLabel,
  Modal,
  ScriptPreview,
  SelectField,
  ToastViewport
} from '@lcl/ui';
import type { ThresholdDirection, RulePresetId } from '@lcl/automation-core';
import { useCallback, useId, useState } from 'react';
import { CodeIcon } from '../../../components/icons/CodeIcon.js';
import {
  useTranslation,
  type Translate,
  type TranslationKey
} from '../../../app/i18n.js';
import { canInstallScript, mutationError, type HardwarePageProps } from '../helpers.js';
import {
  DEFAULT_RULE_ADVANCED_SETTINGS,
  RULE_ADVANCED_LIMITS
} from '../../../flows/hardware-setup/ruleAdvancedSettings.js';
import { useToastQueue } from '../useToastQueue.js';
import { RuleAdvancedSettingsInline } from './RuleAdvancedSettingsInline.js';
import { stripTrailingUnit } from './formUnits.js';
import { useRuleSetupFeedback, type RuleDialogState } from './useRuleSetupFeedback.js';

type RuleControlCopy = {
  labelKey: TranslationKey;
  actionLabelKey: TranslationKey;
  direction: ThresholdDirection;
  unit: string;
  onLabelKey: TranslationKey;
  offLabelKey: TranslationKey;
};

const RULE_PRESET_COPY: Record<RulePresetId, RuleControlCopy> = {
  heating: {
    labelKey: 'hardware.rule.preset.heating',
    actionLabelKey: 'hardware.rule.preset.heatingAction',
    direction: 'below',
    unit: '°C',
    onLabelKey: 'hardware.rule.thresholdOnBelowC',
    offLabelKey: 'hardware.rule.thresholdOffAboveC'
  },
  cooling: {
    labelKey: 'hardware.rule.preset.cooling',
    actionLabelKey: 'hardware.rule.preset.coolingAction',
    direction: 'above',
    unit: '°C',
    onLabelKey: 'hardware.rule.thresholdOnAboveC',
    offLabelKey: 'hardware.rule.thresholdOffBelowC'
  },
  humidifying: {
    labelKey: 'hardware.rule.preset.humidifying',
    actionLabelKey: 'hardware.rule.preset.humidifyingAction',
    direction: 'below',
    unit: '%',
    onLabelKey: 'hardware.rule.thresholdOnBelowPct',
    offLabelKey: 'hardware.rule.thresholdOffAbovePct'
  },
  dehumidifying: {
    labelKey: 'hardware.rule.preset.dehumidifying',
    actionLabelKey: 'hardware.rule.preset.dehumidifyingAction',
    direction: 'above',
    unit: '%',
    onLabelKey: 'hardware.rule.thresholdOnAbovePct',
    offLabelKey: 'hardware.rule.thresholdOffBelowPct'
  }
};

const ALL_RULE_PRESETS: RulePresetId[] = [
  'heating',
  'cooling',
  'humidifying',
  'dehumidifying'
];

const copyToClipboard = async (value: string): Promise<void> => {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    throw new Error('Clipboard API unavailable.');
  }
  await navigator.clipboard.writeText(value);
};

const formatRuleSummary = ({
  actionLabel,
  direction,
  onThreshold,
  offThreshold,
  unit,
  staleTimeoutMin,
  minChangeMin,
  maxOnHours,
  shellyName,
  sensorName,
  vpdAssist,
  rssiMinDbm,
  t
}: {
  actionLabel: string;
  direction: ThresholdDirection;
  onThreshold: number;
  offThreshold: number;
  unit: string;
  staleTimeoutMin: number;
  minChangeMin: number;
  maxOnHours: number;
  shellyName?: string | undefined;
  sensorName?: string | undefined;
  vpdAssist?: string | undefined;
  rssiMinDbm?: number | undefined;
  t: Translate;
}): string => {
  const onComparator =
    direction === 'below'
      ? t('hardware.rule.comparator.below')
      : t('hardware.rule.comparator.above');
  const offComparator =
    direction === 'below'
      ? t('hardware.rule.comparator.above')
      : t('hardware.rule.comparator.below');
  const actionName = `${actionLabel.charAt(0).toUpperCase()}${actionLabel.slice(1)}`;
  const sensorLabel = sensorName
    ? t('hardware.rule.summarySensorNamed', { address: sensorName })
    : t('hardware.rule.summarySensorDefault');
  const shellyLabel = shellyName
    ? t('hardware.rule.summaryShellyNamed', { address: shellyName })
    : t('hardware.rule.summaryShellyDefault');
  const vpdCopy = vpdAssist ? t('hardware.rule.summaryVpd', { vpd: vpdAssist }) : '';
  const rssiCopy = Number.isFinite(rssiMinDbm)
    ? t('hardware.rule.summaryRssi', { rssi: rssiMinDbm as number })
    : '';

  return t('hardware.rule.summary', {
    action: actionName,
    onComparator,
    onThreshold: onThreshold.toFixed(1),
    offComparator,
    offThreshold: offThreshold.toFixed(1),
    unit,
    sensor: sensorLabel,
    staleTimeoutMin,
    shelly: shellyLabel,
    maxOnHours,
    minChangeMin,
    vpd: vpdCopy,
    rssi: rssiCopy
  });
};

type RuleSetupPageProps = HardwarePageProps<RuleSetupFlow> & {
  selectablePresets?: readonly RulePresetId[];
  showShellySelector?: boolean;
};

export const RuleSetupPage = ({
  flow,
  selectablePresets = ALL_RULE_PRESETS,
  showShellySelector = true
}: RuleSetupPageProps) => {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<RuleDialogState>('none');
  const { dismissToast, pushToast, toasts } = useToastQueue('rule-toast');
  const thresholdErrorId = useId();
  const vpdErrorId = useId();
  const vpdTargetInputId = useId();
  const copy = RULE_PRESET_COPY[flow.rulePreset];
  const currentRule =
    flow.configState.ok && flow.configState.config.rule.mode === flow.rulePreset
      ? flow.configState.config.rule
      : null;
  const direction = currentRule?.control.direction ?? copy.direction;
  const vpdAssistLabel = flow.vpdAssistEnabled
    ? flow.isVpdAssistValid
      ? `${Number(flow.vpdTargetInput).toFixed(2)} kPa`
      : t('hardware.rule.values.checkValue')
    : undefined;
  const staleTimeoutMin = Number(flow.staleTimeoutMinInput);
  const minChangeMin = Number(flow.minChangeMinInput);
  const maxOnHours = Number(flow.maxOnHoursInput);
  const rssiMinDbm = Number(flow.rssiMinInput);
  const isScriptActionBusy = flow.loadAutomationScriptMutation.isPending;
  const ruleSummary = formatRuleSummary({
    actionLabel: t(copy.actionLabelKey),
    direction,
    onThreshold: Number(flow.onThresholdInput),
    offThreshold: Number(flow.offThresholdInput),
    unit: copy.unit,
    staleTimeoutMin: Number.isFinite(staleTimeoutMin) ? staleTimeoutMin : 15,
    minChangeMin: Number.isFinite(minChangeMin) ? minChangeMin : 2,
    maxOnHours: Number.isFinite(maxOnHours) ? maxOnHours : 4,
    shellyName: flow.selectedShelly?.name,
    sensorName: flow.selectedSensor?.name,
    vpdAssist: vpdAssistLabel,
    rssiMinDbm:
      Number.isFinite(rssiMinDbm) &&
      flow.rssiMinInput !== DEFAULT_RULE_ADVANCED_SETTINGS.rssiMinInput
        ? rssiMinDbm
        : undefined,
    t
  });

  const copyScript = useCallback(() => {
    if (!flow.configState.ok) {
      return;
    }

    void copyToClipboard(flow.configState.script)
      .then(() => pushToast('ok', t('hardware.rule.copyGeneratedScriptDone')))
      .catch(() =>
        pushToast(
          'warning',
          t('hardware.rule.copyScriptFailedTitle'),
          t('hardware.rule.copyScriptFailedDetail')
        )
      );
  }, [flow.configState, pushToast, t]);

  useRuleSetupFeedback({ flow, pushToast, setDialog, t });

  const loadScriptFromShelly = () => {
    if (!flow.selectedShelly) {
      return;
    }
    flow.loadAutomationScript(flow.selectedShelly);
  };

  const runSafeRelayTest = () => {
    flow.safeRelayTestMutation.mutate();
  };

  const closeRelayTestModal = () => {
    if (flow.safeRelayTestMutation.isPending) {
      return;
    }
    setDialog('none');
  };

  return (
    <section className="demo-panel" aria-label={t('hardware.nav.ruleTitle')}>
      {showShellySelector && (
        <div className="field">
          <span>{t('hardware.rule.selectedShelly')}</span>
          <SelectField
            ariaLabel={t('hardware.rule.selectedShelly')}
            value={flow.selectedShellyId ?? ''}
            placeholder={t('hardware.rule.noShellySelected')}
            options={flow.shellyDevices.map((device) => ({
              value: device.id,
              label: device.name
            }))}
            onChange={flow.selectShellyDevice}
          />
        </div>
      )}

      <div className="field">
        <span>{t('hardware.rule.selectedSensor')}</span>
        <SelectField
          ariaLabel={t('hardware.rule.selectedSensor')}
          value={flow.selectedSensorId ?? ''}
          placeholder={t('hardware.flow.noSelectedSensor')}
          options={flow.sensorDevices.map((device) => ({
            value: device.id,
            label: device.name
          }))}
          onChange={flow.selectSensorDevice}
        />
      </div>

      <div className="field">
        <InfoLabel
          label={t('hardware.rule.ruleMode')}
          infoLabel={t('hardware.rule.summaryTitle')}
          title={t('hardware.rule.summaryTitle')}
        >
          {ruleSummary}
        </InfoLabel>
        <SelectField<RulePresetId>
          ariaLabel={t('hardware.rule.ruleMode')}
          value={flow.rulePreset}
          options={selectablePresets.map((preset) => ({
            value: preset,
            label: t(RULE_PRESET_COPY[preset].labelKey)
          }))}
          onChange={flow.setRulePreset}
        />
      </div>

      <div className="field-row">
        <label className={flow.isThresholdValid ? 'field' : 'field field--invalid'}>
          <span>{stripTrailingUnit(t(copy.onLabelKey), copy.unit)}</span>
          <span className="field-unit-control">
            <input
              aria-label={t(copy.onLabelKey)}
              aria-describedby={flow.isThresholdValid ? undefined : thresholdErrorId}
              aria-invalid={!flow.isThresholdValid}
              type="number"
              step="0.1"
              value={flow.onThresholdInput}
              onChange={(event) => flow.setOnThresholdInput(event.currentTarget.value)}
            />
            <span className="field-unit-control__unit" aria-hidden="true">
              {copy.unit}
            </span>
          </span>
        </label>
        <label className={flow.isThresholdValid ? 'field' : 'field field--invalid'}>
          <span>{stripTrailingUnit(t(copy.offLabelKey), copy.unit)}</span>
          <span className="field-unit-control">
            <input
              aria-label={t(copy.offLabelKey)}
              aria-describedby={flow.isThresholdValid ? undefined : thresholdErrorId}
              aria-invalid={!flow.isThresholdValid}
              type="number"
              step="0.1"
              value={flow.offThresholdInput}
              onChange={(event) => flow.setOffThresholdInput(event.currentTarget.value)}
            />
            <span className="field-unit-control__unit" aria-hidden="true">
              {copy.unit}
            </span>
          </span>
          {!flow.isThresholdValid && (
            <span className="field__error" id={thresholdErrorId}>
              {t('hardware.rule.thresholdInvalid')}
            </span>
          )}
        </label>
      </div>

      <section className="rule-vpd-assist">
        <div className="rule-vpd-assist__header">
          <InfoLabel
            label={<strong>{t('hardware.rule.vpdAssistTitle')}</strong>}
            infoLabel={t('hardware.rule.vpdAssistHint')}
            title={t('hardware.rule.vpdAssistTitle')}
          >
            {t('hardware.rule.vpdAssistHint')}
            <br />
            <br />
            {t('hardware.rule.vpdRangeHint')}
          </InfoLabel>
          <label className="toggle-row rule-vpd-assist__toggle">
            <input
              aria-label={t('hardware.rule.vpdAssistTitle')}
              type="checkbox"
              checked={flow.vpdAssistEnabled}
              onChange={(event) => flow.setVpdAssistEnabled(event.currentTarget.checked)}
            />
            <span className="rule-vpd-assist__toggle-state">
              {flow.vpdAssistEnabled ? t('common.enabled') : t('common.disabled')}
            </span>
          </label>
        </div>
        {flow.vpdAssistEnabled && (
          <div
            className={`field rule-vpd-target-row ${flow.isVpdAssistValid ? '' : 'field--invalid'}`}
          >
            <label className="rule-vpd-target-row__label" htmlFor={vpdTargetInputId}>
              {t('hardware.rule.vpdTargetShort')}
            </label>
            <span className="field-unit-control">
              <input
                id={vpdTargetInputId}
                aria-label={t('hardware.rule.vpdTarget')}
                aria-describedby={flow.isVpdAssistValid ? undefined : vpdErrorId}
                aria-invalid={!flow.isVpdAssistValid}
                max={RULE_ADVANCED_LIMITS.vpdTargetMax}
                min={RULE_ADVANCED_LIMITS.vpdTargetMin}
                step="0.05"
                type="number"
                value={flow.vpdTargetInput}
                onChange={(event) => flow.setVpdTargetInput(event.currentTarget.value)}
              />
              <span className="field-unit-control__unit" aria-hidden="true">
                kPa
              </span>
            </span>
            {!flow.isVpdAssistValid && (
              <span className="field__error rule-vpd-target-row__error" id={vpdErrorId}>
                {t('hardware.rule.range.kpa')}
              </span>
            )}
          </div>
        )}
      </section>

      <div className="action-row rule-action-row">
        <button
          className="primary-action"
          type="button"
          aria-busy={flow.installMutation.isPending}
          disabled={
            !canInstallScript(flow) ||
            flow.installMutation.isPending ||
            flow.safeRelayTestMutation.isPending
          }
          title={t('hardware.rule.sendTitle')}
          onClick={() => flow.installMutation.mutate()}
        >
          {flow.installMutation.isPending ? t('common.sending') : t('common.send')}
        </button>
      </div>

      <div className="rule-progressive-disclosure-stack">
        <details className="rule-progressive-disclosure">
          <summary>{t('hardware.rule.advanced')}</summary>
          <RuleAdvancedSettingsInline flow={flow} />
        </details>

        <details className="rule-progressive-disclosure rule-progressive-disclosure--developer">
          <summary>{t('hardware.rule.developerTools')}</summary>
          <div className="rule-progressive-disclosure__body">
            <div className="action-row rule-developer-actions rule-developer-actions--compact">
              <button
                className="secondary-action"
                type="button"
                disabled={!flow.configState.ok}
                title={t('hardware.rule.scriptPreviewTitle')}
                onClick={() => setDialog('script')}
              >
                <CodeIcon />
                {t('hardware.rule.scriptPreview')}
              </button>
              <button
                className="secondary-action"
                type="button"
                aria-busy={flow.loadAutomationScriptMutation.isPending}
                disabled={!flow.selectedShelly || isScriptActionBusy}
                title={t('hardware.rule.loadScriptFromShellyTitle')}
                onClick={loadScriptFromShelly}
              >
                {flow.loadAutomationScriptMutation.isPending
                  ? t('hardware.rule.loadingScriptFromShelly')
                  : t('hardware.rule.loadScriptFromShelly')}
              </button>
            </div>
          </div>
        </details>
      </div>

      <Modal
        closeLabel={t('common.close')}
        open={dialog === 'install-block' && flow.installMutation.isError}
        title={t('hardware.rule.installBlockedTitle')}
        onClose={() => {
          setDialog('none');
          flow.installMutation.reset();
        }}
      >
        {flow.installMutation.isError && (
          <FeedbackPanel tone="danger" title={mutationError(flow.installMutation.error)}>
            {t('hardware.rule.installMatterHelp')}
          </FeedbackPanel>
        )}
      </Modal>
      <Modal
        actions={
          <button
            className="primary-action"
            type="button"
            aria-busy={flow.safeRelayTestMutation.isPending}
            disabled={!flow.canRunSafeRelayTest || flow.safeRelayTestMutation.isPending}
            title={t('hardware.rule.relayTestTitleAttr')}
            onClick={runSafeRelayTest}
          >
            {flow.safeRelayTestMutation.isPending
              ? t('common.testing')
              : t('common.test')}
          </button>
        }
        busy={flow.safeRelayTestMutation.isPending}
        closeLabel={t('common.close')}
        dismissible={false}
        open={dialog === 'relay-test' && flow.canRunSafeRelayTest}
        title={t('hardware.rule.relayTestTitle')}
        onClose={closeRelayTestModal}
      >
        <FeedbackPanel tone="warning" title={t('hardware.safety.heatingDefaultOff')}>
          {t('hardware.safety.noHeater')}
        </FeedbackPanel>
      </Modal>
      <Modal
        closeLabel={t('common.close')}
        open={dialog === 'script' && flow.configState.ok}
        size="workspace"
        title={t('hardware.rule.scriptPreview')}
        onClose={() => setDialog('none')}
      >
        {flow.configState.ok && (
          <ScriptPreview
            label={t('hardware.rule.generatedScriptLabel')}
            code={flow.configState.script}
            copyAriaLabel={t('hardware.rule.copyGeneratedScriptLabel')}
            copyLabel={t('hardware.rule.copyGeneratedScriptLabel')}
            variant="fill"
            onCopy={copyScript}
          />
        )}
      </Modal>
      <ToastViewport
        dismissLabel={t('toast.dismiss')}
        label={t('toast.regionLabel')}
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </section>
  );
};
