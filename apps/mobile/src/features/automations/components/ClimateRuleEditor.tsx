import type { RulePresetId, ThresholdDirection } from '@lcl/automation-core';
import type { ClimateSensorAggregation } from '@lcl/script-generator';
import { InfoLabel, SelectField } from '@lcl/ui';
import { useId } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import { CodeIcon } from '../../../components/icons/CodeIcon.js';
import {
  DEFAULT_RULE_ADVANCED_SETTINGS,
  RULE_ADVANCED_LIMITS
} from '../data/climateRuleSettings.js';
import {
  ALL_RULE_PRESETS,
  formatRuleSummary,
  RULE_PRESET_COPY,
  stripTrailingUnit
} from '../presentation/climateRulePresentation.js';
import { ClimateRuleAdvancedSettings } from './ClimateRuleAdvancedSettings.js';

import {
  ClimateRuleDeviceSelectors,
  type ClimateRuleDevice,
  type ClimateRuleLiveReading,
  type ClimateRuleSensorDevice
} from './ClimateRuleDeviceSelectors.js';

export type { ClimateRuleLiveReading } from './ClimateRuleDeviceSelectors.js';

export type ClimateRuleEditorProps = {
  selectablePresets?: readonly RulePresetId[];
  showShellySelector?: boolean;
  shellyDevices: readonly ClimateRuleDevice[];
  selectedShellyId: string | null;
  selectedShellyName: string | undefined;
  hasSelectedShelly: boolean;
  selectShellyDevice(value: string): void;
  sensorDevices: readonly ClimateRuleSensorDevice[];
  selectedSensorId: string | null;
  selectedSensorName: string | undefined;
  additionalSensorIds: readonly string[];
  sensorAggregation: ClimateSensorAggregation;
  sensorLiveReadings: Record<string, ClimateRuleLiveReading>;
  selectSensorDevice(value: string): void;
  toggleAdditionalSensorDevice(value: string): void;
  setSensorAggregation(value: ClimateSensorAggregation): void;
  rulePreset: RulePresetId;
  controlDirection: ThresholdDirection | undefined;
  setRulePreset(value: RulePresetId): void;
  onThresholdInput: string;
  setOnThresholdInput(value: string): void;
  offThresholdInput: string;
  setOffThresholdInput(value: string): void;
  isThresholdValid: boolean;
  vpdAssistEnabled: boolean;
  setVpdAssistEnabled(value: boolean): void;
  vpdTargetInput: string;
  setVpdTargetInput(value: string): void;
  isVpdAssistValid: boolean;
  rssiMinInput: string;
  setRssiMinInput(value: string): void;
  staleTimeoutMinInput: string;
  setStaleTimeoutMinInput(value: string): void;
  minChangeMinInput: string;
  setMinChangeMinInput(value: string): void;
  maxOnHoursInput: string;
  setMaxOnHoursInput(value: string): void;
  canPreviewScript: boolean;
  loadScriptPending: boolean;
  openScriptPreview(): void;
  loadScriptFromShelly(): void;
  canInstall: boolean;
  installPending: boolean;
  safeRelayTestPending: boolean;
  install(): void;
  submitMode?: 'install' | 'edit';
};

export const ClimateRuleEditor = ({
  selectablePresets = ALL_RULE_PRESETS,
  showShellySelector = true,
  ...props
}: ClimateRuleEditorProps) => {
  const { t } = useTranslation();
  const thresholdErrorId = useId();
  const vpdErrorId = useId();
  const vpdTargetInputId = useId();
  const copy = RULE_PRESET_COPY[props.rulePreset];
  const direction = props.controlDirection ?? copy.direction;
  const vpdAssistLabel = props.vpdAssistEnabled
    ? props.isVpdAssistValid
      ? `${Number(props.vpdTargetInput).toFixed(2)} kPa`
      : t('hardware.rule.values.checkValue')
    : undefined;
  const staleTimeoutMin = Number(props.staleTimeoutMinInput);
  const minChangeMin = Number(props.minChangeMinInput);
  const maxOnHours = Number(props.maxOnHoursInput);
  const rssiMinDbm = Number(props.rssiMinInput);
  const ruleSummary = formatRuleSummary({
    actionLabel: t(copy.actionLabelKey),
    direction,
    onThreshold: Number(props.onThresholdInput),
    offThreshold: Number(props.offThresholdInput),
    unit: copy.unit,
    staleTimeoutMin: Number.isFinite(staleTimeoutMin) ? staleTimeoutMin : 15,
    minChangeMin: Number.isFinite(minChangeMin) ? minChangeMin : 2,
    maxOnHours: Number.isFinite(maxOnHours) ? maxOnHours : 4,
    shellyName: props.selectedShellyName,
    sensorName: props.selectedSensorName,
    vpdAssist: vpdAssistLabel,
    rssiMinDbm:
      Number.isFinite(rssiMinDbm) &&
      props.rssiMinInput !== DEFAULT_RULE_ADVANCED_SETTINGS.rssiMinInput
        ? rssiMinDbm
        : undefined,
    t
  });

  return (
    <>
      <ClimateRuleDeviceSelectors
        showShellySelector={showShellySelector}
        shellyDevices={props.shellyDevices}
        selectedShellyId={props.selectedShellyId}
        selectShellyDevice={props.selectShellyDevice}
        sensorDevices={props.sensorDevices}
        selectedSensorId={props.selectedSensorId}
        additionalSensorIds={props.additionalSensorIds}
        sensorAggregation={props.sensorAggregation}
        sensorLiveReadings={props.sensorLiveReadings}
        selectSensorDevice={props.selectSensorDevice}
        toggleAdditionalSensorDevice={props.toggleAdditionalSensorDevice}
        setSensorAggregation={props.setSensorAggregation}
      />

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
          value={props.rulePreset}
          options={selectablePresets.map((preset) => ({
            value: preset,
            label: t(RULE_PRESET_COPY[preset].labelKey)
          }))}
          onChange={props.setRulePreset}
        />
      </div>

      <div className="field-row">
        <label className={props.isThresholdValid ? 'field' : 'field field--invalid'}>
          <span>{stripTrailingUnit(t(copy.onLabelKey), copy.unit)}</span>
          <span className="field-unit-control">
            <input
              aria-label={t(copy.onLabelKey)}
              aria-describedby={props.isThresholdValid ? undefined : thresholdErrorId}
              aria-invalid={!props.isThresholdValid}
              type="number"
              step="0.1"
              value={props.onThresholdInput}
              onChange={(event) => props.setOnThresholdInput(event.currentTarget.value)}
            />
            <span className="field-unit-control__unit" aria-hidden="true">
              {copy.unit}
            </span>
          </span>
        </label>
        <label className={props.isThresholdValid ? 'field' : 'field field--invalid'}>
          <span>{stripTrailingUnit(t(copy.offLabelKey), copy.unit)}</span>
          <span className="field-unit-control">
            <input
              aria-label={t(copy.offLabelKey)}
              aria-describedby={props.isThresholdValid ? undefined : thresholdErrorId}
              aria-invalid={!props.isThresholdValid}
              type="number"
              step="0.1"
              value={props.offThresholdInput}
              onChange={(event) => props.setOffThresholdInput(event.currentTarget.value)}
            />
            <span className="field-unit-control__unit" aria-hidden="true">
              {copy.unit}
            </span>
          </span>
          {!props.isThresholdValid && (
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
              checked={props.vpdAssistEnabled}
              onChange={(event) => props.setVpdAssistEnabled(event.currentTarget.checked)}
            />
            <span className="rule-vpd-assist__toggle-state">
              {props.vpdAssistEnabled ? t('common.enabled') : t('common.disabled')}
            </span>
          </label>
        </div>
        {props.vpdAssistEnabled && (
          <div
            className={`field rule-vpd-target-row ${
              props.isVpdAssistValid ? '' : 'field--invalid'
            }`}
          >
            <label className="rule-vpd-target-row__label" htmlFor={vpdTargetInputId}>
              {t('hardware.rule.vpdTargetShort')}
            </label>
            <span className="field-unit-control">
              <input
                id={vpdTargetInputId}
                aria-label={t('hardware.rule.vpdTarget')}
                aria-describedby={props.isVpdAssistValid ? undefined : vpdErrorId}
                aria-invalid={!props.isVpdAssistValid}
                max={RULE_ADVANCED_LIMITS.vpdTargetMax}
                min={RULE_ADVANCED_LIMITS.vpdTargetMin}
                step="0.05"
                type="number"
                value={props.vpdTargetInput}
                onChange={(event) => props.setVpdTargetInput(event.currentTarget.value)}
              />
              <span className="field-unit-control__unit" aria-hidden="true">
                kPa
              </span>
            </span>
            {!props.isVpdAssistValid && (
              <span className="field__error rule-vpd-target-row__error" id={vpdErrorId}>
                {t('hardware.rule.range.kpa')}
              </span>
            )}
          </div>
        )}
      </section>

      <div className="action-row rule-developer-actions rule-developer-actions--compact">
        <button
          className="secondary-action"
          type="button"
          disabled={!props.canPreviewScript}
          title={t('hardware.rule.scriptPreviewTitle')}
          onClick={props.openScriptPreview}
        >
          <CodeIcon />
          {t('hardware.rule.scriptPreview')}
        </button>
        <button
          className="secondary-action"
          type="button"
          aria-busy={props.loadScriptPending}
          disabled={!props.hasSelectedShelly || props.loadScriptPending}
          title={t('hardware.rule.loadScriptFromShellyTitle')}
          onClick={props.loadScriptFromShelly}
        >
          {props.loadScriptPending
            ? t('hardware.rule.loadingScriptFromShelly')
            : t('hardware.rule.loadScriptFromShelly')}
        </button>
      </div>

      <details className="rule-progressive-disclosure">
        <summary>{t('hardware.rule.advanced')}</summary>
        <ClimateRuleAdvancedSettings
          vpdAssistEnabled={props.vpdAssistEnabled}
          vpdTargetInput={props.vpdTargetInput}
          rssiMinInput={props.rssiMinInput}
          staleTimeoutMinInput={props.staleTimeoutMinInput}
          minChangeMinInput={props.minChangeMinInput}
          maxOnHoursInput={props.maxOnHoursInput}
          setRssiMinInput={props.setRssiMinInput}
          setStaleTimeoutMinInput={props.setStaleTimeoutMinInput}
          setMinChangeMinInput={props.setMinChangeMinInput}
          setMaxOnHoursInput={props.setMaxOnHoursInput}
        />
      </details>

      <div className="action-row rule-action-row">
        <button
          className="primary-action"
          type="button"
          aria-busy={props.installPending}
          disabled={
            !props.canInstall || props.installPending || props.safeRelayTestPending
          }
          title={
            props.submitMode === 'edit'
              ? t('hardware.rule.saveChangesTitle')
              : t('hardware.rule.sendTitle')
          }
          onClick={props.install}
        >
          {props.submitMode === 'edit'
            ? props.installPending
              ? t('hardware.rule.savingChanges')
              : t('hardware.rule.saveChanges')
            : props.installPending
              ? t('common.sending')
              : t('common.send')}
        </button>
      </div>
    </>
  );
};
