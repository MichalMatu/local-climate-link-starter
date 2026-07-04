import {
  DiagnosticRow,
  FeedbackPanel,
  Modal,
  RuleSummaryCard,
  ScriptPreview,
  ToastViewport,
  type ToastMessage,
  type ToastTone
} from '@lcl/ui';
import type { ThresholdDirection, RulePresetId } from '@lcl/automation-core';
import {
  decodeShellyThermostatScript,
  stableStringify,
  type DecodedShellyThermostatScript
} from '@lcl/script-generator';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
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

const SELECTABLE_RULE_PRESETS: RulePresetId[] = [
  'heating',
  'cooling',
  'humidifying',
  'dehumidifying'
];

const decodedModeLabel = (mode: RulePresetId, t: Translate): string =>
  t(RULE_PRESET_COPY[mode].labelKey);

const DECODED_PROFILE_LABELS: Record<
  DecodedShellyThermostatScript['settings']['sensorProfileId'],
  string
> = {
  xiaomi_lywsd03mmc_bthome_v2: 'Xiaomi/PVVX BTHome v2',
  tp357_custom_v1: 'TP357'
};

const copyToClipboard = async (value: string): Promise<void> => {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    throw new Error('Clipboard API unavailable.');
  }
  await navigator.clipboard.writeText(value);
};

const GeneratedScriptIcon = () => (
  <svg
    aria-hidden="true"
    className="icon-action__svg"
    focusable="false"
    viewBox="0 0 24 24"
  >
    <path d="m9 8-4 4 4 4" />
    <path d="m15 8 4 4-4 4" />
    <path d="m13 6-2 12" />
  </svg>
);

const createAdvancedDraft = (
  flow: HardwarePageProps['flow']
): RuleAdvancedSettingsInput => ({
  vpdAssistEnabled: flow.vpdAssistEnabled,
  vpdTargetInput: flow.vpdTargetInput,
  rssiMinInput: flow.rssiMinInput,
  staleTimeoutMinInput: flow.staleTimeoutMinInput,
  minChangeMinInput: flow.minChangeMinInput,
  maxOnHoursInput: flow.maxOnHoursInput
});

const formatDecodedUnit = (
  metric: DecodedShellyThermostatScript['settings']['control']['metric']
): string => (metric === 'humidity' ? '%' : '°C');

const formatDecodedComparator = (
  direction: ThresholdDirection,
  isOn: boolean,
  t: Translate
): string =>
  direction === 'below'
    ? isOn
      ? t('hardware.rule.comparator.below')
      : t('hardware.rule.comparator.above')
    : isOn
      ? t('hardware.rule.comparator.above')
      : t('hardware.rule.comparator.below');

const formatDecodedThresholds = (
  settings: DecodedShellyThermostatScript['settings'],
  t: Translate
): string => {
  const unit = formatDecodedUnit(settings.control.metric);
  const onComparator = formatDecodedComparator(settings.control.direction, true, t);
  const offComparator = formatDecodedComparator(settings.control.direction, false, t);
  return `ON ${onComparator} ${settings.control.onThreshold.toFixed(1)}${unit}, OFF ${offComparator} ${settings.control.offThreshold.toFixed(1)}${unit}`;
};

const formatDecodedSeconds = (seconds: number): string =>
  seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`;

const formatDecodedMs = (milliseconds: number): string => {
  if (milliseconds % 3_600_000 === 0) {
    return `${milliseconds / 3_600_000} h`;
  }
  if (milliseconds % 60_000 === 0) {
    return `${milliseconds / 60_000} min`;
  }
  return `${milliseconds / 1000} s`;
};

const formatDecodedVpd = (
  settings: DecodedShellyThermostatScript['settings'],
  t: Translate
): string =>
  settings.vpdAssist.enabled && settings.vpdAssist.targetKpa !== null
    ? `${settings.vpdAssist.targetKpa.toFixed(2)} kPa`
    : t('hardware.rule.values.disabled');

const decodedRuntimeConfigMatches = (
  left: DecodedShellyThermostatScript | null,
  right: DecodedShellyThermostatScript | null
): boolean | null => {
  if (!left || !right) {
    return null;
  }
  return stableStringify(left.runtimeConfig) === stableStringify(right.runtimeConfig);
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

export const RuleSetupPage = ({ flow }: HardwarePageProps) => {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [isScriptManagerModalOpen, setIsScriptManagerModalOpen] = useState(false);
  const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);
  const [isDeleteConfirmActive, setIsDeleteConfirmActive] = useState(false);
  const [isInstallBlockModalOpen, setIsInstallBlockModalOpen] = useState(false);
  const [isRelayTestModalOpen, setIsRelayTestModalOpen] = useState(false);
  const [advancedDraft, setAdvancedDraft] = useState<RuleAdvancedSettingsInput>(() =>
    createAdvancedDraft(flow)
  );
  const thresholdErrorId = useId();
  const advancedVpdHintId = useId();
  const advancedVpdErrorId = useId();
  const toastIdRef = useRef(0);
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
  const selectedScriptState =
    flow.automationScriptState?.deviceId === flow.selectedShelly?.id
      ? flow.automationScriptState
      : null;
  const selectedScript = selectedScriptState?.script ?? null;
  const selectedScriptCode = selectedScriptState?.code ?? null;
  const decodedSelectedScript = useMemo(
    () => (selectedScriptCode ? decodeShellyThermostatScript(selectedScriptCode) : null),
    [selectedScriptCode]
  );
  const decodedCurrentScript = useMemo(
    () =>
      flow.configState.ok ? decodeShellyThermostatScript(flow.configState.script) : null,
    [flow.configState]
  );
  const selectedScriptSettings = decodedSelectedScript?.settings ?? null;
  const scriptSettingsMatch = decodedRuntimeConfigMatches(
    decodedSelectedScript,
    decodedCurrentScript
  );
  const scriptStatusLabel = selectedScript
    ? t('hardware.rule.scriptStatus', {
        id: selectedScript.id,
        status: selectedScript.running
          ? t('hardware.status.running')
          : t('hardware.status.stopped')
      })
    : t('hardware.rule.values.noScript');
  const isScriptManagerBusy =
    flow.fetchAutomationScriptMutation.isPending ||
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

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((tone: ToastTone, title: string, detail?: string) => {
    toastIdRef.current += 1;
    const id = `rule-toast-${toastIdRef.current}`;
    const toast: ToastMessage =
      detail === undefined ? { id, tone, title } : { id, tone, title, detail };
    setToasts((current) => [...current.slice(-2), toast]);
  }, []);

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

  const copyManagedScript = useCallback(() => {
    if (!selectedScriptCode) {
      return;
    }

    void copyToClipboard(selectedScriptCode)
      .then(() => pushToast('ok', t('hardware.rule.copyManagedScriptDone')))
      .catch(() =>
        pushToast(
          'warning',
          t('hardware.rule.copyScriptFailedTitle'),
          t('hardware.rule.copyScriptFailedDetail')
        )
      );
  }, [pushToast, selectedScriptCode, t]);

  useEffect(() => {
    setIsDeleteConfirmActive(false);
  }, [flow.selectedShellyId]);

  useEffect(() => {
    if (!flow.fetchAutomationScriptMutation.isError) {
      return;
    }
    pushToast(
      'warning',
      t('hardware.rule.readScriptFailedTitle'),
      mutationError(flow.fetchAutomationScriptMutation.error)
    );
    flow.fetchAutomationScriptMutation.reset();
  }, [flow.fetchAutomationScriptMutation, pushToast, t]);

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
    setIsDeleteConfirmActive(false);
    pushToast('ok', t('hardware.rule.deleteScriptDone'));
    flow.deleteAutomationScriptMutation.reset();
  }, [flow.deleteAutomationScriptMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.installMutation.isError) {
      return;
    }
    setIsInstallBlockModalOpen(true);
  }, [flow.installMutation.error, flow.installMutation.isError]);

  useEffect(() => {
    if (!flow.installMutation.isSuccess || !flow.canRunSafeRelayTest) {
      return;
    }
    setIsRelayTestModalOpen(true);
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
    setIsRelayTestModalOpen(false);
    pushToast('ok', t('hardware.ready'), t('hardware.rule.relayTestDone'));
    flow.safeRelayTestMutation.reset();
  }, [flow.safeRelayTestMutation, pushToast, t]);

  const openScriptManagerModal = () => {
    setIsScriptManagerModalOpen(true);
    setIsDeleteConfirmActive(false);
    if (flow.selectedShelly) {
      flow.fetchAutomationScript(flow.selectedShelly);
    }
  };

  const deleteManagedScript = () => {
    if (!flow.selectedShelly || !selectedScript) {
      return;
    }
    if (!isDeleteConfirmActive) {
      setIsDeleteConfirmActive(true);
      return;
    }
    flow.deleteAutomationScript(flow.selectedShelly);
  };

  const openAdvancedModal = () => {
    setAdvancedDraft(createAdvancedDraft(flow));
    setIsAdvancedModalOpen(true);
  };

  const resetAdvancedDraft = () => {
    setAdvancedDraft(DEFAULT_RULE_ADVANCED_SETTINGS);
  };

  const updateAdvancedDraft = (patch: Partial<RuleAdvancedSettingsInput>) => {
    setAdvancedDraft((current) => ({ ...current, ...patch }));
  };

  const applyAdvancedDraft = () => {
    if (!advancedDraftValidation.isValid) {
      return;
    }

    flow.setVpdAssistEnabled(advancedDraft.vpdAssistEnabled);
    flow.setVpdTargetInput(advancedDraft.vpdTargetInput);
    flow.setRssiMinInput(advancedDraft.rssiMinInput);
    flow.setStaleTimeoutMinInput(advancedDraft.staleTimeoutMinInput);
    flow.setMinChangeMinInput(advancedDraft.minChangeMinInput);
    flow.setMaxOnHoursInput(advancedDraft.maxOnHoursInput);
    setIsAdvancedModalOpen(false);
  };

  const runSafeRelayTest = () => {
    flow.safeRelayTestMutation.mutate();
  };

  const closeRelayTestModal = () => {
    if (flow.safeRelayTestMutation.isPending) {
      return;
    }
    setIsRelayTestModalOpen(false);
  };

  const closeScriptManagerModal = () => {
    if (isScriptManagerBusy) {
      return;
    }
    setIsScriptManagerModalOpen(false);
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
            {SELECTABLE_RULE_PRESETS.map((preset) => (
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

      <RuleSummaryCard
        action={
          <button
            aria-label={t('hardware.rule.scriptPreviewAria')}
            className="icon-action rule-summary-icon-action"
            type="button"
            disabled={!flow.configState.ok}
            title={t('hardware.rule.scriptPreviewTitle')}
            onClick={() => setIsScriptModalOpen(true)}
          >
            <GeneratedScriptIcon />
          </button>
        }
        title={t('hardware.rule.summaryTitle')}
        summary={ruleSummary}
      />

      <div className="action-row rule-action-row">
        <button
          className="secondary-action"
          type="button"
          title={t('hardware.rule.advancedTitleAttr')}
          onClick={openAdvancedModal}
        >
          {t('hardware.rule.advanced')}
        </button>
        <button
          className="secondary-action"
          type="button"
          disabled={!flow.selectedShelly}
          title={t('hardware.rule.scriptManagerTitle')}
          onClick={openScriptManagerModal}
        >
          {t('hardware.rule.scriptManager')}
        </button>
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

      <Modal
        closeLabel={t('common.close')}
        open={isInstallBlockModalOpen && flow.installMutation.isError}
        title={t('hardware.rule.installBlockedTitle')}
        onClose={() => {
          setIsInstallBlockModalOpen(false);
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
        open={isRelayTestModalOpen && flow.canRunSafeRelayTest}
        title={t('hardware.rule.relayTestTitle')}
        onClose={closeRelayTestModal}
      >
        <FeedbackPanel tone="warning" title={t('hardware.safety.heatingDefaultOff')}>
          {t('hardware.safety.noHeater')}
        </FeedbackPanel>
      </Modal>
      <Modal
        closeLabel={t('common.close')}
        open={isScriptModalOpen && flow.configState.ok}
        size="workspace"
        title={t('hardware.rule.scriptPreview')}
        onClose={() => setIsScriptModalOpen(false)}
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
            className={
              isDeleteConfirmActive
                ? 'secondary-action secondary-action--danger'
                : 'secondary-action'
            }
            type="button"
            disabled={
              !flow.selectedShelly ||
              !selectedScript ||
              flow.deleteAutomationScriptMutation.isPending
            }
            title={
              isDeleteConfirmActive
                ? t('hardware.rule.deleteScriptConfirmTitle')
                : t('hardware.rule.deleteScriptTitle')
            }
            onClick={deleteManagedScript}
          >
            {flow.deleteAutomationScriptMutation.isPending
              ? t('hardware.rule.deleting')
              : isDeleteConfirmActive
                ? t('common.confirmDelete')
                : t('hardware.rule.deleteScriptFromShelly')}
          </button>
        }
        busy={isScriptManagerBusy}
        closeLabel={t('common.close')}
        open={isScriptManagerModalOpen}
        size="diagnostic"
        title={t('hardware.rule.scriptManager')}
        onClose={closeScriptManagerModal}
      >
        {flow.selectedShelly ? (
          <>
            <DiagnosticRow
              label={t('hardware.rule.selectedShelly')}
              value={flow.selectedShelly.name}
            />
            <DiagnosticRow
              href={flow.selectedShelly.baseUrl}
              label={t('common.address')}
              linkLabel={t('hardware.shelly.openPanelLabel', {
                address: flow.selectedShelly.baseUrl
              })}
              value={flow.selectedShelly.baseUrl}
            />
            <DiagnosticRow
              label={t('hardware.rule.script')}
              tone={selectedScript ? 'normal' : 'warning'}
              value={scriptStatusLabel}
            />
            {decodedSelectedScript && selectedScriptSettings && (
              <section
                aria-label={t('hardware.rule.decodedSettingsLabel')}
                className="script-settings"
              >
                <h3>{t('hardware.rule.decodedSettings')}</h3>
                {scriptSettingsMatch !== null && (
                  <DiagnosticRow
                    label={t('hardware.rule.values.compatibility')}
                    tone={scriptSettingsMatch ? 'normal' : 'warning'}
                    value={
                      scriptSettingsMatch
                        ? t('hardware.rule.values.formMatch')
                        : t('hardware.rule.values.formDifferent')
                    }
                  />
                )}
                <DiagnosticRow
                  label={t('hardware.rule.values.profile')}
                  value={DECODED_PROFILE_LABELS[selectedScriptSettings.sensorProfileId]}
                />
                <DiagnosticRow
                  label={t('hardware.rule.selectedSensor')}
                  value={selectedScriptSettings.runtimeAddress}
                />
                <DiagnosticRow
                  label={t('hardware.rule.values.rule')}
                  value={decodedModeLabel(selectedScriptSettings.mode, t)}
                />
                <DiagnosticRow
                  label={t('hardware.rule.values.thresholds')}
                  value={formatDecodedThresholds(selectedScriptSettings, t)}
                />
                <DiagnosticRow
                  label={t('hardware.rule.staleTimeoutLabel')}
                  value={formatDecodedSeconds(selectedScriptSettings.staleTimeoutSec)}
                />
                <DiagnosticRow
                  label={t('hardware.metrics.maxWork')}
                  value={formatDecodedMs(selectedScriptSettings.maxOnMs)}
                />
                <DiagnosticRow
                  label={t('hardware.metrics.minChange')}
                  value={formatDecodedMs(selectedScriptSettings.minChangeMs)}
                />
                <DiagnosticRow
                  label="RSSI"
                  value={`min. ${selectedScriptSettings.rssiMin} dBm`}
                />
                <DiagnosticRow
                  label="VPD"
                  value={formatDecodedVpd(selectedScriptSettings, t)}
                />
                <DiagnosticRow
                  label={t('hardware.metrics.relay')}
                  value={`switch:${selectedScriptSettings.relayId}`}
                />
                <DiagnosticRow
                  label={t('hardware.metrics.configHash')}
                  value={decodedSelectedScript.configHash ?? t('common.missing')}
                />
              </section>
            )}
            {selectedScriptCode && !decodedSelectedScript && (
              <p>{t('hardware.rule.managedScriptUnknown')}</p>
            )}
            {selectedScriptCode ? (
              <ScriptPreview
                label={t('hardware.rule.managedScriptLabel')}
                code={selectedScriptCode}
                copyAriaLabel={t('hardware.rule.shellyScriptCopyLabel')}
                copyLabel={t('common.copy')}
                variant="tall"
                onCopy={copyManagedScript}
              />
            ) : !flow.fetchAutomationScriptMutation.isPending ? (
              <p>{t('hardware.rule.managedScriptMissingCode')}</p>
            ) : null}
          </>
        ) : (
          <p>{t('hardware.rule.noShellySelected')}</p>
        )}
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
        open={isAdvancedModalOpen}
        title={t('hardware.rule.advancedTitle')}
        onClose={() => setIsAdvancedModalOpen(false)}
      >
        <div className="advanced-settings">
          <section className="advanced-settings__section">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={advancedDraft.vpdAssistEnabled}
                onChange={(event) =>
                  updateAdvancedDraft({ vpdAssistEnabled: event.currentTarget.checked })
                }
              />
              <span>VPD assist</span>
            </label>
            <label
              className={`field ${
                advancedDraftValidation.isVpdTargetValid ? '' : 'field--invalid'
              }`}
            >
              {t('hardware.rule.vpdTarget')}
              <input
                aria-describedby={
                  advancedDraftValidation.isVpdTargetValid
                    ? advancedVpdHintId
                    : `${advancedVpdHintId} ${advancedVpdErrorId}`
                }
                aria-invalid={!advancedDraftValidation.isVpdTargetValid}
                disabled={!advancedDraft.vpdAssistEnabled}
                max={RULE_ADVANCED_LIMITS.vpdTargetMax}
                min={RULE_ADVANCED_LIMITS.vpdTargetMin}
                step="0.05"
                type="number"
                value={advancedDraft.vpdTargetInput}
                onChange={(event) =>
                  updateAdvancedDraft({ vpdTargetInput: event.currentTarget.value })
                }
              />
              <span className="field__hint" id={advancedVpdHintId}>
                {t('hardware.rule.vpdRangeHint')}
              </span>
              {!advancedDraftValidation.isVpdTargetValid && (
                <span className="field__error" id={advancedVpdErrorId}>
                  {t('hardware.rule.range.kpa')}
                </span>
              )}
            </label>
          </section>

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
