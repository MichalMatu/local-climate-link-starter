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
import { t } from '../../../app/i18n.js';
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
  label: string;
  actionLabel: string;
  direction: ThresholdDirection;
  unit: string;
  onLabel: string;
  offLabel: string;
};

const RULE_PRESET_COPY: Record<RulePresetId, RuleControlCopy> = {
  heating: {
    label: 'Grzanie',
    actionLabel: 'grzanie',
    direction: 'below',
    unit: '°C',
    onLabel: 'Włącz poniżej °C',
    offLabel: 'Wyłącz powyżej °C'
  },
  cooling: {
    label: 'Chłodzenie',
    actionLabel: 'chłodzenie',
    direction: 'above',
    unit: '°C',
    onLabel: 'Włącz powyżej °C',
    offLabel: 'Wyłącz poniżej °C'
  },
  humidifying: {
    label: 'Nawilżanie',
    actionLabel: 'nawilżanie',
    direction: 'below',
    unit: '%',
    onLabel: 'Włącz poniżej %',
    offLabel: 'Wyłącz powyżej %'
  },
  dehumidifying: {
    label: 'Osuszanie',
    actionLabel: 'osuszanie',
    direction: 'above',
    unit: '%',
    onLabel: 'Włącz powyżej %',
    offLabel: 'Wyłącz poniżej %'
  }
};

const SELECTABLE_RULE_PRESETS: RulePresetId[] = [
  'heating',
  'cooling',
  'humidifying',
  'dehumidifying'
];

const DECODED_MODE_LABELS: Record<RulePresetId, string> = {
  heating: 'Grzanie',
  cooling: 'Chłodzenie',
  humidifying: 'Nawilżanie',
  dehumidifying: 'Osuszanie'
};

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
  maxOnHoursInput: flow.maxOnHoursInput
});

const formatDecodedUnit = (
  metric: DecodedShellyThermostatScript['settings']['control']['metric']
): string => (metric === 'humidity' ? '%' : '°C');

const formatDecodedComparator = (direction: ThresholdDirection, isOn: boolean): string =>
  direction === 'below' ? (isOn ? 'poniżej' : 'powyżej') : isOn ? 'powyżej' : 'poniżej';

const formatDecodedThresholds = (
  settings: DecodedShellyThermostatScript['settings']
): string => {
  const unit = formatDecodedUnit(settings.control.metric);
  const onComparator = formatDecodedComparator(settings.control.direction, true);
  const offComparator = formatDecodedComparator(settings.control.direction, false);
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

const formatDecodedVpd = (settings: DecodedShellyThermostatScript['settings']): string =>
  settings.vpdAssist.enabled && settings.vpdAssist.targetKpa !== null
    ? `${settings.vpdAssist.targetKpa.toFixed(2)} kPa`
    : 'wyłączony';

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
  maxOnHours,
  shellyAddress,
  sensorRuntimeAddress,
  vpdAssist,
  rssiMinDbm
}: {
  actionLabel: string;
  direction: ThresholdDirection;
  onThreshold: number;
  offThreshold: number;
  unit: string;
  staleTimeoutMin: number;
  maxOnHours: number;
  shellyAddress?: string | undefined;
  sensorRuntimeAddress?: string | undefined;
  vpdAssist?: string | undefined;
  rssiMinDbm?: number | undefined;
}): string => {
  const onComparator = direction === 'below' ? 'poniżej' : 'powyżej';
  const offComparator = direction === 'below' ? 'powyżej' : 'poniżej';
  const actionName = `${actionLabel.charAt(0).toUpperCase()}${actionLabel.slice(1)}`;
  const sensorLabel = sensorRuntimeAddress
    ? `termometr ${sensorRuntimeAddress}`
    : 'termometr';
  const shellyLabel = shellyAddress ? `Shelly ${shellyAddress}` : 'Shelly';
  const vpdCopy = vpdAssist ? ` VPD assist uwzględni cel ${vpdAssist}.` : '';
  const rssiCopy = Number.isFinite(rssiMinDbm)
    ? ` Sygnał termometru musi mieć co najmniej ${rssiMinDbm} dBm.`
    : '';

  return `${actionName} włączy się ${onComparator} ${onThreshold.toFixed(1)}${unit} i wyłączy ${offComparator} ${offThreshold.toFixed(1)}${unit}. Gdy ${sensorLabel} zniknie na ${staleTimeoutMin} min albo ${shellyLabel} uruchomi się ponownie, przekaźnik wyłączy się bezpiecznie. Po świeżym odczycie automatyka znów zastosuje tę regułę. Maksymalny czas pracy: ${maxOnHours} h.${vpdCopy}${rssiCopy}`;
};

export const RuleSetupPage = ({ flow }: HardwarePageProps) => {
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
      : 'sprawdź wartość'
    : undefined;
  const advancedDraftValidation = validateRuleAdvancedSettings(advancedDraft);
  const staleTimeoutMin = Number(flow.staleTimeoutMinInput);
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
    ? `id ${selectedScript.id}, ${selectedScript.running ? 'działa' : 'zatrzymany'}`
    : 'brak';
  const isScriptManagerBusy =
    flow.fetchAutomationScriptMutation.isPending ||
    flow.deleteAutomationScriptMutation.isPending;
  const ruleSummary = formatRuleSummary({
    actionLabel: copy.actionLabel,
    direction,
    onThreshold: Number(flow.onThresholdInput),
    offThreshold: Number(flow.offThresholdInput),
    unit: copy.unit,
    staleTimeoutMin: Number.isFinite(staleTimeoutMin) ? staleTimeoutMin : 15,
    maxOnHours: Number.isFinite(maxOnHours) ? maxOnHours : 4,
    shellyAddress: flow.selectedShelly ? shellyAddressLabel(flow) : undefined,
    sensorRuntimeAddress: flow.selectedSensor ? runtimeAddressLabel(flow) : undefined,
    vpdAssist: vpdAssistLabel,
    rssiMinDbm:
      Number.isFinite(rssiMinDbm) &&
      flow.rssiMinInput !== DEFAULT_RULE_ADVANCED_SETTINGS.rssiMinInput
        ? rssiMinDbm
        : undefined
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
  }, [flow.configState, pushToast]);

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
  }, [pushToast, selectedScriptCode]);

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
  }, [flow.fetchAutomationScriptMutation, pushToast]);

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
  }, [flow.deleteAutomationScriptMutation, pushToast]);

  useEffect(() => {
    if (!flow.deleteAutomationScriptMutation.isSuccess) {
      return;
    }
    setIsDeleteConfirmActive(false);
    pushToast('ok', t('hardware.rule.deleteScriptDone'));
    flow.deleteAutomationScriptMutation.reset();
  }, [flow.deleteAutomationScriptMutation, pushToast]);

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
  }, [flow.safeRelayTestMutation, pushToast]);

  useEffect(() => {
    if (!flow.safeRelayTestMutation.isSuccess) {
      return;
    }
    setIsRelayTestModalOpen(false);
    pushToast('ok', t('hardware.ready'), t('hardware.rule.relayTestDone'));
    flow.safeRelayTestMutation.reset();
  }, [flow.safeRelayTestMutation, pushToast]);

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
    <section className="demo-panel" aria-label="Reguła automatyzacji">
      <label className="field">
        Gniazdko Shelly
        <span className="select-control">
          <select
            value={flow.selectedShellyId ?? ''}
            onChange={(event) => flow.selectShellyDevice(event.currentTarget.value)}
          >
            <option value="" disabled>
              Wybierz gniazdko
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
        Termometr
        <span className="select-control">
          <select
            value={flow.selectedSensorId ?? ''}
            onChange={(event) => flow.selectSensorDevice(event.currentTarget.value)}
          >
            <option value="" disabled>
              Wybierz termometr
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
        Tryb reguły
        <span className="select-control">
          <select
            value={flow.rulePreset}
            onChange={(event) =>
              flow.setRulePreset(event.currentTarget.value as RulePresetId)
            }
          >
            {SELECTABLE_RULE_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {RULE_PRESET_COPY[preset].label}
              </option>
            ))}
          </select>
        </span>
      </label>

      <div className="field-row">
        <label className={flow.isThresholdValid ? 'field' : 'field field--invalid'}>
          {copy.onLabel}
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
          {copy.offLabel}
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
            aria-label="Pokaż skrypt"
            className="icon-action rule-summary-icon-action"
            type="button"
            disabled={!flow.configState.ok}
            title="Pokaż wygenerowany Shelly Script"
            onClick={() => setIsScriptModalOpen(true)}
          >
            <GeneratedScriptIcon />
          </button>
        }
        title="Podsumowanie reguły"
        summary={ruleSummary}
      />

      <div className="action-row rule-action-row">
        <button
          className="secondary-action"
          type="button"
          title="Zmień RSSI, timeout, VPD i limity bezpieczeństwa"
          onClick={openAdvancedModal}
        >
          Zaawansowane
        </button>
        <button
          className="secondary-action"
          type="button"
          disabled={!flow.selectedShelly}
          title="Odczytaj albo usuń skrypt zapisany w Shelly"
          onClick={openScriptManagerModal}
        >
          Skrypt Shelly
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
          title="Wyślij aktualną regułę do Shelly"
          onClick={() => flow.installMutation.mutate()}
        >
          {flow.installMutation.isPending ? t('common.sending') : t('common.send')}
        </button>
      </div>

      <Modal
        closeLabel="Zamknij"
        open={isInstallBlockModalOpen && flow.installMutation.isError}
        title={t('hardware.rule.installBlockedTitle')}
        onClose={() => {
          setIsInstallBlockModalOpen(false);
          flow.installMutation.reset();
        }}
      >
        {flow.installMutation.isError && (
          <FeedbackPanel tone="danger" title={mutationError(flow.installMutation.error)}>
            Jeśli Matter blokuje skrypty, wyłącz Matter w Shelly i spróbuj ponownie.
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
            title="Uruchom krótki test przekaźnika i zakończ stanem OFF"
            onClick={runSafeRelayTest}
          >
            {flow.safeRelayTestMutation.isPending
              ? t('common.testing')
              : t('common.test')}
          </button>
        }
        closeLabel="Zamknij"
        closeOnBackdrop={false}
        closeOnEscape={!flow.safeRelayTestMutation.isPending}
        open={isRelayTestModalOpen && flow.canRunSafeRelayTest}
        title={t('hardware.rule.relayTestTitle')}
        onClose={closeRelayTestModal}
      >
        <FeedbackPanel tone="warning" title={t('hardware.safety.heatingDefaultOff')}>
          {t('hardware.safety.noHeater')}
        </FeedbackPanel>
      </Modal>
      <Modal
        closeLabel="Zamknij"
        open={isScriptModalOpen && flow.configState.ok}
        size="workspace"
        title={t('hardware.rule.scriptPreview')}
        onClose={() => setIsScriptModalOpen(false)}
      >
        {flow.configState.ok && (
          <ScriptPreview
            label="Wygenerowany skrypt"
            code={flow.configState.script}
            copyAriaLabel="Kopiuj skrypt"
            copyLabel="Kopiuj"
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
                ? 'Potwierdź usunięcie skryptu z Shelly'
                : 'Usuń skrypt Local Climate Link z Shelly'
            }
            onClick={deleteManagedScript}
          >
            {flow.deleteAutomationScriptMutation.isPending
              ? 'Usuwam'
              : isDeleteConfirmActive
                ? 'Potwierdź usuń'
                : 'Usuń z Shelly'}
          </button>
        }
        closeLabel="Zamknij"
        closeOnBackdrop={false}
        closeOnEscape={!isScriptManagerBusy}
        open={isScriptManagerModalOpen}
        size="diagnostic"
        title="Skrypt Shelly"
        onClose={closeScriptManagerModal}
      >
        {flow.selectedShelly ? (
          <>
            <DiagnosticRow label="Gniazdko" value={flow.selectedShelly.name} />
            <DiagnosticRow
              href={flow.selectedShelly.baseUrl}
              label="Adres"
              linkLabel={`Otwórz panel Shelly: ${flow.selectedShelly.baseUrl}`}
              value={flow.selectedShelly.baseUrl}
            />
            <DiagnosticRow
              label="Skrypt"
              tone={selectedScript ? 'normal' : 'warning'}
              value={scriptStatusLabel}
            />
            {decodedSelectedScript && selectedScriptSettings && (
              <section
                aria-label="Odczytane ustawienia skryptu"
                className="script-settings"
              >
                <h3>Odczytane ustawienia</h3>
                {scriptSettingsMatch !== null && (
                  <DiagnosticRow
                    label="Zgodność"
                    tone={scriptSettingsMatch ? 'normal' : 'warning'}
                    value={
                      scriptSettingsMatch
                        ? 'zgodne z formularzem'
                        : 'różni się od formularza'
                    }
                  />
                )}
                <DiagnosticRow
                  label="Profil"
                  value={DECODED_PROFILE_LABELS[selectedScriptSettings.sensorProfileId]}
                />
                <DiagnosticRow
                  label="Termometr"
                  value={selectedScriptSettings.runtimeAddress}
                />
                <DiagnosticRow
                  label="Reguła"
                  value={DECODED_MODE_LABELS[selectedScriptSettings.mode]}
                />
                <DiagnosticRow
                  label="Progi"
                  value={formatDecodedThresholds(selectedScriptSettings)}
                />
                <DiagnosticRow
                  label="Brak odczytu"
                  value={formatDecodedSeconds(selectedScriptSettings.staleTimeoutSec)}
                />
                <DiagnosticRow
                  label="Maks. praca"
                  value={formatDecodedMs(selectedScriptSettings.maxOnMs)}
                />
                <DiagnosticRow
                  label="Min. zmiana"
                  value={formatDecodedMs(selectedScriptSettings.minChangeMs)}
                />
                <DiagnosticRow
                  label="RSSI"
                  value={`min. ${selectedScriptSettings.rssiMin} dBm`}
                />
                <DiagnosticRow
                  label="VPD"
                  value={formatDecodedVpd(selectedScriptSettings)}
                />
                <DiagnosticRow
                  label="Przekaźnik"
                  value={`switch:${selectedScriptSettings.relayId}`}
                />
                <DiagnosticRow
                  label="Config hash"
                  value={decodedSelectedScript.configHash ?? 'brak'}
                />
              </section>
            )}
            {selectedScriptCode && !decodedSelectedScript && (
              <p>Nie umiem odczytać ustawień z tego skryptu.</p>
            )}
            {selectedScriptCode ? (
              <ScriptPreview
                label="Skrypt zapisany w Shelly"
                code={selectedScriptCode}
                copyAriaLabel="Kopiuj skrypt z Shelly"
                copyLabel="Kopiuj"
                variant="tall"
                onCopy={copyManagedScript}
              />
            ) : !flow.fetchAutomationScriptMutation.isPending ? (
              <p>Nie mam pobranego kodu skryptu z Shelly.</p>
            ) : null}
          </>
        ) : (
          <p>Wybierz gniazdko Shelly.</p>
        )}
      </Modal>
      <Modal
        actions={
          <>
            <button
              className="secondary-action"
              type="button"
              title="Przywróć domyślne opcje zaawansowane"
              onClick={resetAdvancedDraft}
            >
              Domyślne
            </button>
            <button
              className="primary-action"
              type="button"
              disabled={!advancedDraftValidation.isValid}
              title="Zastosuj opcje zaawansowane do tej reguły"
              onClick={applyAdvancedDraft}
            >
              Zastosuj
            </button>
          </>
        }
        closeLabel="Zamknij"
        open={isAdvancedModalOpen}
        title="Opcje zaawansowane"
        onClose={() => setIsAdvancedModalOpen(false)}
      >
        <div className="advanced-settings">
          <section className="advanced-settings__section">
            <h3>Odczyt termometru</h3>
            <div className="field-row">
              <label
                className={`field ${
                  advancedDraftValidation.isRssiMinValid ? '' : 'field--invalid'
                }`}
              >
                Minimalny RSSI dBm
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
                    Zakres: -100 do -20 dBm.
                  </span>
                )}
              </label>
              <label
                className={`field ${
                  advancedDraftValidation.isStaleTimeoutValid ? '' : 'field--invalid'
                }`}
              >
                Brak odczytu przez min
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
                    Zakres: 1 do 120 min.
                  </span>
                )}
              </label>
            </div>
          </section>

          <section className="advanced-settings__section">
            <h3>VPD</h3>
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
              Docelowe VPD kPa
              <input
                aria-describedby={
                  advancedDraftValidation.isVpdTargetValid
                    ? undefined
                    : 'advanced-vpd-error'
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
              {!advancedDraftValidation.isVpdTargetValid && (
                <span className="field__error" id="advanced-vpd-error">
                  Zakres: 0.1 do 5 kPa.
                </span>
              )}
            </label>
          </section>

          <section className="advanced-settings__section">
            <h3>Bezpieczeństwo gniazdka</h3>
            <div className="advanced-settings__readonly">
              <span>Po restarcie Shelly</span>
              <strong>OFF, potem AUTO po pierwszym odczycie</strong>
            </div>
          </section>

          <section className="advanced-settings__section">
            <h3>Limit pracy</h3>
            <label
              className={`field ${
                advancedDraftValidation.isMaxOnHoursValid ? '' : 'field--invalid'
              }`}
            >
              Maksymalny czas pracy h
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
                  Zakres: 0.25 do 24 h.
                </span>
              )}
            </label>
          </section>
        </div>
      </Modal>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </section>
  );
};
