import type { RuleSetupFlow } from '../pageContracts.js';
import {
  FeedbackPanel,
  Modal,
  RuleSummaryCard,
  ScriptPreview,
  ToastViewport
} from '@lcl/ui';
import type { ThresholdDirection, RulePresetId } from '@lcl/automation-core';
import { IconTrash } from '@tabler/icons-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { CodeIcon } from '../../../components/icons/CodeIcon.js';
import {
  useTranslation,
  type Translate,
  type TranslationKey
} from '../../../app/i18n.js';
import {
  canInstallScript,
  mutationError,
  runtimeAddressLabel,
  shellyAddressLabel,
  type HardwarePageProps
} from '../helpers.js';
import {
  DEFAULT_RULE_ADVANCED_SETTINGS,
  RULE_ADVANCED_LIMITS,
  type RuleAdvancedSettingsInput,
  validateRuleAdvancedSettings
} from '../../../flows/hardware-setup/ruleAdvancedSettings.js';
import { useToastQueue } from '../useToastQueue.js';

type RuleDialogState =
  'none' | 'script' | 'advanced' | 'delete' | 'install-block' | 'relay-test';

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

const createAdvancedDraft = (flow: RuleSetupFlow): RuleAdvancedSettingsInput => ({
  vpdAssistEnabled: flow.vpdAssistEnabled,
  vpdTargetInput: flow.vpdTargetInput,
  rssiMinInput: flow.rssiMinInput,
  staleTimeoutMinInput: flow.staleTimeoutMinInput,
  minChangeMinInput: flow.minChangeMinInput,
  maxOnHoursInput: flow.maxOnHoursInput
});

const formatRuleSummary = ({
  actionLabel,
  direction,
  onThreshold,
  offThreshold,
  unit,
  staleTimeoutMin,
  minChangeMin,
  maxOnHours,
  shellyAddress,
  sensorRuntimeAddress,
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
  shellyAddress?: string | undefined;
  sensorRuntimeAddress?: string | undefined;
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
  const sensorLabel = sensorRuntimeAddress
    ? t('hardware.rule.summarySensorNamed', { address: sensorRuntimeAddress })
    : t('hardware.rule.summarySensorDefault');
  const shellyLabel = shellyAddress
    ? t('hardware.rule.summaryShellyNamed', { address: shellyAddress })
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
  onOpenDiagnostics?: () => void;
};

export const RuleSetupPage = ({
  flow,
  selectablePresets = ALL_RULE_PRESETS,
  onOpenDiagnostics
}: RuleSetupPageProps) => {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<RuleDialogState>('none');
  const { dismissToast, pushToast, toasts } = useToastQueue('rule-toast');
  const [advancedDraft, setAdvancedDraft] = useState<RuleAdvancedSettingsInput>(() =>
    createAdvancedDraft(flow)
  );
  const thresholdErrorId = useId();
  const vpdHintId = useId();
  const vpdErrorId = useId();
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
  const advancedDraftValidation = validateRuleAdvancedSettings(advancedDraft);
  const staleTimeoutMin = Number(flow.staleTimeoutMinInput);
  const minChangeMin = Number(flow.minChangeMinInput);
  const maxOnHours = Number(flow.maxOnHoursInput);
  const rssiMinDbm = Number(flow.rssiMinInput);
  const isScriptActionBusy =
    flow.loadAutomationScriptMutation.isPending ||
    flow.deleteAutomationScriptMutation.isPending;
  const ruleSummary = formatRuleSummary({
    actionLabel: t(copy.actionLabelKey),
    direction,
    onThreshold: Number(flow.onThresholdInput),
    offThreshold: Number(flow.offThresholdInput),
    unit: copy.unit,
    staleTimeoutMin: Number.isFinite(staleTimeoutMin) ? staleTimeoutMin : 15,
    minChangeMin: Number.isFinite(minChangeMin) ? minChangeMin : 2,
    maxOnHours: Number.isFinite(maxOnHours) ? maxOnHours : 4,
    shellyAddress: flow.selectedShelly ? shellyAddressLabel(flow) : undefined,
    sensorRuntimeAddress: flow.selectedSensor ? runtimeAddressLabel(flow) : undefined,
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

  useEffect(() => {
    setDialog((current) => (current === 'delete' ? 'none' : current));
  }, [flow.selectedShellyId]);

  useEffect(() => {
    if (!flow.loadAutomationScriptMutation.isError) {
      return;
    }
    pushToast(
      'warning',
      t('hardware.rule.readScriptFailedTitle'),
      mutationError(flow.loadAutomationScriptMutation.error)
    );
    flow.loadAutomationScriptMutation.reset();
  }, [flow.loadAutomationScriptMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.loadAutomationScriptMutation.isSuccess) {
      return;
    }
    pushToast('ok', t('hardware.rule.loadScriptDone'));
    flow.loadAutomationScriptMutation.reset();
  }, [flow.loadAutomationScriptMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.deleteAutomationScriptMutation.isError) {
      return;
    }
    pushToast(
      'warning',
      t('hardware.rule.deleteScriptFailedTitle'),
      mutationError(flow.deleteAutomationScriptMutation.error)
    );
    flow.deleteAutomationScriptMutation.reset();
  }, [flow.deleteAutomationScriptMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.deleteAutomationScriptMutation.isSuccess) {
      return;
    }
    setDialog('none');
    pushToast('ok', t('hardware.rule.deleteScriptDone'));
    flow.deleteAutomationScriptMutation.reset();
  }, [flow.deleteAutomationScriptMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.installMutation.isError) {
      return;
    }
    setDialog('install-block');
  }, [flow.installMutation.error, flow.installMutation.isError]);

  useEffect(() => {
    if (!flow.installMutation.isSuccess || !flow.canRunSafeRelayTest) {
      return;
    }
    setDialog('relay-test');
    flow.installMutation.reset();
  }, [flow.canRunSafeRelayTest, flow.installMutation]);

  useEffect(() => {
    if (!flow.safeRelayTestMutation.isError) {
      return;
    }
    pushToast(
      'warning',
      t('hardware.rule.relayTestFailedTitle'),
      mutationError(flow.safeRelayTestMutation.error)
    );
    flow.safeRelayTestMutation.reset();
  }, [flow.safeRelayTestMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.safeRelayTestMutation.isSuccess) {
      return;
    }
    setDialog('none');
    pushToast('ok', t('hardware.ready'), t('hardware.rule.relayTestDone'));
    flow.safeRelayTestMutation.reset();
  }, [flow.safeRelayTestMutation, pushToast, t]);

  const loadScriptFromShelly = () => {
    if (!flow.selectedShelly) {
      return;
    }
    flow.loadAutomationScript(flow.selectedShelly);
  };

  const deleteManagedScript = () => {
    if (!flow.selectedShelly) {
      return;
    }
    flow.deleteAutomationScript(flow.selectedShelly);
  };

  const openAdvancedModal = () => {
    setAdvancedDraft(createAdvancedDraft(flow));
    setDialog('advanced');
  };

  const resetAdvancedDraft = () => {
    setAdvancedDraft({
      ...DEFAULT_RULE_ADVANCED_SETTINGS,
      vpdAssistEnabled: flow.vpdAssistEnabled,
      vpdTargetInput: flow.vpdTargetInput
    });
  };

  const updateAdvancedDraft = (patch: Partial<RuleAdvancedSettingsInput>) => {
    setAdvancedDraft((current) => ({ ...current, ...patch }));
  };

  const applyAdvancedDraft = () => {
    if (!advancedDraftValidation.isValid) {
      return;
    }

    flow.setRssiMinInput(advancedDraft.rssiMinInput);
    flow.setStaleTimeoutMinInput(advancedDraft.staleTimeoutMinInput);
    flow.setMinChangeMinInput(advancedDraft.minChangeMinInput);
    flow.setMaxOnHoursInput(advancedDraft.maxOnHoursInput);
    setDialog('none');
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
      <label className="field">
        {t('hardware.rule.selectedShelly')}
        <span className="select-control">
          <select
            value={flow.selectedShellyId ?? ''}
            onChange={(event) => flow.selectShellyDevice(event.currentTarget.value)}
          >
            <option value="" disabled>
              {t('hardware.rule.noShellySelected')}
            </option>
            {flow.shellyDevices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>
        </span>
      </label>

      <label className="field">
        {t('hardware.rule.selectedSensor')}
        <span className="select-control">
          <select
            value={flow.selectedSensorId ?? ''}
            onChange={(event) => flow.selectSensorDevice(event.currentTarget.value)}
          >
            <option value="" disabled>
              {t('hardware.flow.noSelectedSensor')}
            </option>
            {flow.sensorDevices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>
        </span>
      </label>

      <label className="field">
        {t('hardware.rule.ruleMode')}
        <span className="select-control">
          <select
            value={flow.rulePreset}
            onChange={(event) =>
              flow.setRulePreset(event.currentTarget.value as RulePresetId)
            }
          >
            {selectablePresets.map((preset) => (
              <option key={preset} value={preset}>
                {t(RULE_PRESET_COPY[preset].labelKey)}
              </option>
            ))}
          </select>
        </span>
      </label>

      <div className="field-row">
        <label className={flow.isThresholdValid ? 'field' : 'field field--invalid'}>
          {t(copy.onLabelKey)}
          <input
            aria-describedby={flow.isThresholdValid ? undefined : thresholdErrorId}
            aria-invalid={!flow.isThresholdValid}
            type="number"
            step="0.1"
            value={flow.onThresholdInput}
            onChange={(event) => flow.setOnThresholdInput(event.currentTarget.value)}
          />
        </label>
        <label className={flow.isThresholdValid ? 'field' : 'field field--invalid'}>
          {t(copy.offLabelKey)}
          <input
            aria-describedby={flow.isThresholdValid ? undefined : thresholdErrorId}
            aria-invalid={!flow.isThresholdValid}
            type="number"
            step="0.1"
            value={flow.offThresholdInput}
            onChange={(event) => flow.setOffThresholdInput(event.currentTarget.value)}
          />
          {!flow.isThresholdValid && (
            <span className="field__error" id={thresholdErrorId}>
              {t('hardware.rule.thresholdInvalid')}
            </span>
          )}
        </label>
      </div>

      <section className="rule-vpd-assist">
        <div className="rule-vpd-assist__header">
          <div>
            <strong>{t('hardware.rule.vpdAssistTitle')}</strong>
            <p>{t('hardware.rule.vpdAssistHint')}</p>
          </div>
          <label className="toggle-row rule-vpd-assist__toggle">
            <input
              aria-label={t('hardware.rule.vpdAssistTitle')}
              type="checkbox"
              checked={flow.vpdAssistEnabled}
              onChange={(event) => flow.setVpdAssistEnabled(event.currentTarget.checked)}
            />
            <span>
              {flow.vpdAssistEnabled ? t('common.enabled') : t('common.disabled')}
            </span>
          </label>
        </div>
        {flow.vpdAssistEnabled && (
          <label className={`field ${flow.isVpdAssistValid ? '' : 'field--invalid'}`}>
            {t('hardware.rule.vpdTarget')}
            <input
              aria-describedby={
                flow.isVpdAssistValid ? vpdHintId : `${vpdHintId} ${vpdErrorId}`
              }
              aria-invalid={!flow.isVpdAssistValid}
              max={RULE_ADVANCED_LIMITS.vpdTargetMax}
              min={RULE_ADVANCED_LIMITS.vpdTargetMin}
              step="0.05"
              type="number"
              value={flow.vpdTargetInput}
              onChange={(event) => flow.setVpdTargetInput(event.currentTarget.value)}
            />
            <span className="field__hint" id={vpdHintId}>
              {t('hardware.rule.vpdRangeHint')}
            </span>
            {!flow.isVpdAssistValid && (
              <span className="field__error" id={vpdErrorId}>
                {t('hardware.rule.range.kpa')}
              </span>
            )}
          </label>
        )}
      </section>

      <RuleSummaryCard title={t('hardware.rule.summaryTitle')} summary={ruleSummary} />

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
          <div className="rule-progressive-disclosure__body">
            <p>{t('hardware.rule.advancedDisclosureHint')}</p>
            <button
              className="secondary-action"
              type="button"
              title={t('hardware.rule.advancedTitleAttr')}
              onClick={openAdvancedModal}
            >
              {t('hardware.rule.openAdvanced')}
            </button>
          </div>
        </details>

        <details className="rule-progressive-disclosure rule-progressive-disclosure--developer">
          <summary>{t('hardware.rule.developerTools')}</summary>
          <div className="rule-progressive-disclosure__body">
            <p>{t('hardware.rule.developerToolsHint')}</p>
            <div className="action-row rule-developer-actions">
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
              <button
                className="secondary-action secondary-action--danger"
                type="button"
                disabled={!flow.selectedShelly || isScriptActionBusy}
                title={t('hardware.rule.deleteScriptTitle')}
                onClick={() => setDialog('delete')}
              >
                <IconTrash className="icon-action__svg" aria-hidden="true" />
                {t('hardware.rule.deleteScriptFromShelly')}
              </button>
              {onOpenDiagnostics && (
                <button
                  className="secondary-action"
                  type="button"
                  onClick={onOpenDiagnostics}
                >
                  {t('hardware.rule.openDeveloperDiagnostics')}
                </button>
              )}
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
      <Modal
        actions={
          <button
            className="secondary-action secondary-action--danger"
            type="button"
            disabled={
              !flow.selectedShelly || flow.deleteAutomationScriptMutation.isPending
            }
            title={t('hardware.rule.deleteScriptConfirmTitle')}
            onClick={deleteManagedScript}
          >
            {flow.deleteAutomationScriptMutation.isPending
              ? t('hardware.rule.deleting')
              : t('common.confirmDelete')}
          </button>
        }
        busy={flow.deleteAutomationScriptMutation.isPending}
        closeLabel={t('common.close')}
        open={dialog === 'delete'}
        title={t('hardware.rule.deleteScriptConfirmTitle')}
        onClose={() => {
          if (!flow.deleteAutomationScriptMutation.isPending) {
            setDialog('none');
          }
        }}
      >
        <FeedbackPanel tone="warning" title={t('hardware.rule.deleteScriptTitle')}>
          {t('hardware.rule.deleteScriptConfirmDetail')}
        </FeedbackPanel>
      </Modal>
      <Modal
        actions={
          <>
            <button
              className="secondary-action"
              type="button"
              title={t('hardware.rule.advancedDefaultsTitle')}
              onClick={resetAdvancedDraft}
            >
              {t('common.default')}
            </button>
            <button
              className="primary-action"
              type="button"
              disabled={!advancedDraftValidation.isValid}
              title={t('hardware.rule.advancedApplyTitle')}
              onClick={applyAdvancedDraft}
            >
              {t('common.apply')}
            </button>
          </>
        }
        closeLabel={t('common.close')}
        open={dialog === 'advanced'}
        title={t('hardware.rule.advancedTitle')}
        onClose={() => setDialog('none')}
      >
        <div className="advanced-settings">
          <section className="advanced-settings__section">
            <div className="field-row">
              <label
                className={`field ${
                  advancedDraftValidation.isMinChangeMinValid ? '' : 'field--invalid'
                }`}
              >
                {t('hardware.rule.minChangeLabel')}
                <input
                  aria-describedby={
                    advancedDraftValidation.isMinChangeMinValid
                      ? undefined
                      : 'advanced-min-change-error'
                  }
                  aria-invalid={!advancedDraftValidation.isMinChangeMinValid}
                  max={RULE_ADVANCED_LIMITS.minChangeMinMax}
                  min={RULE_ADVANCED_LIMITS.minChangeMinMin}
                  step="0.25"
                  type="number"
                  value={advancedDraft.minChangeMinInput}
                  onChange={(event) =>
                    updateAdvancedDraft({
                      minChangeMinInput: event.currentTarget.value
                    })
                  }
                />
                {!advancedDraftValidation.isMinChangeMinValid && (
                  <span className="field__error" id="advanced-min-change-error">
                    {t('hardware.rule.range.minChange')}
                  </span>
                )}
              </label>
              <label
                className={`field ${
                  advancedDraftValidation.isMaxOnHoursValid ? '' : 'field--invalid'
                }`}
              >
                {t('hardware.rule.maxOnHoursLabel')}
                <input
                  aria-describedby={
                    advancedDraftValidation.isMaxOnHoursValid
                      ? undefined
                      : 'advanced-max-on-error'
                  }
                  aria-invalid={!advancedDraftValidation.isMaxOnHoursValid}
                  max={RULE_ADVANCED_LIMITS.maxOnHoursMax}
                  min={RULE_ADVANCED_LIMITS.maxOnHoursMin}
                  step="0.25"
                  type="number"
                  value={advancedDraft.maxOnHoursInput}
                  onChange={(event) =>
                    updateAdvancedDraft({ maxOnHoursInput: event.currentTarget.value })
                  }
                />
                {!advancedDraftValidation.isMaxOnHoursValid && (
                  <span className="field__error" id="advanced-max-on-error">
                    {t('hardware.rule.range.maxOn')}
                  </span>
                )}
              </label>
            </div>
            <div className="advanced-settings__readonly">
              <span>{t('hardware.rule.bootBehavior')}</span>
              <strong>{t('hardware.rule.bootBehaviorValue')}</strong>
            </div>
          </section>

          <section className="advanced-settings__section">
            <div className="field-row">
              <label
                className={`field ${
                  advancedDraftValidation.isStaleTimeoutValid ? '' : 'field--invalid'
                }`}
              >
                {t('hardware.rule.staleTimeoutLabel')}
                <input
                  aria-describedby={
                    advancedDraftValidation.isStaleTimeoutValid
                      ? undefined
                      : 'advanced-stale-error'
                  }
                  aria-invalid={!advancedDraftValidation.isStaleTimeoutValid}
                  max={RULE_ADVANCED_LIMITS.staleTimeoutMinMax}
                  min={RULE_ADVANCED_LIMITS.staleTimeoutMinMin}
                  step="1"
                  type="number"
                  value={advancedDraft.staleTimeoutMinInput}
                  onChange={(event) =>
                    updateAdvancedDraft({
                      staleTimeoutMinInput: event.currentTarget.value
                    })
                  }
                />
                {!advancedDraftValidation.isStaleTimeoutValid && (
                  <span className="field__error" id="advanced-stale-error">
                    {t('hardware.rule.range.stale')}
                  </span>
                )}
              </label>
              <label
                className={`field ${
                  advancedDraftValidation.isRssiMinValid ? '' : 'field--invalid'
                }`}
              >
                {t('hardware.rule.rssiMinLabel')}
                <input
                  aria-describedby={
                    advancedDraftValidation.isRssiMinValid
                      ? undefined
                      : 'advanced-rssi-error'
                  }
                  aria-invalid={!advancedDraftValidation.isRssiMinValid}
                  max={RULE_ADVANCED_LIMITS.rssiMinMax}
                  min={RULE_ADVANCED_LIMITS.rssiMinMin}
                  step="1"
                  type="number"
                  value={advancedDraft.rssiMinInput}
                  onChange={(event) =>
                    updateAdvancedDraft({ rssiMinInput: event.currentTarget.value })
                  }
                />
                {!advancedDraftValidation.isRssiMinValid && (
                  <span className="field__error" id="advanced-rssi-error">
                    {t('hardware.rule.range.rssi')}
                  </span>
                )}
              </label>
            </div>
          </section>
        </div>
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
