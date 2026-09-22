import type { RuleSetupFlow } from '../pageContracts.js';
import type { RulePresetId } from '@lcl/automation-core';
import { FeedbackPanel, Modal, ScriptPreview } from '@lcl/ui';
import { useCallback, useEffect, useState } from 'react';
import { AppToastViewport } from '../../../components/AppToastViewport.js';
import { useTranslation } from '../../../app/i18n.js';
import {
  ALL_RULE_PRESETS,
  ClimateRuleEditor
} from '../../../features/automations/index.js';
import { useRuleSensorReadings } from '../../../flows/hardware-setup/useRuleSensorReadings.js';
import { useSavedSensorLiveScanLifecycle } from '../../../flows/hardware-setup/useSavedSensorLiveScanLifecycle.js';
import { canInstallScript, mutationError, type HardwarePageProps } from '../helpers.js';
import { useToastQueue } from '../useToastQueue.js';
import { useRuleSetupFeedback, type RuleDialogState } from './useRuleSetupFeedback.js';

const copyToClipboard = async (value: string): Promise<void> => {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    throw new Error('Clipboard API unavailable.');
  }
  await navigator.clipboard.writeText(value);
};

type RuleSetupPageProps = HardwarePageProps<RuleSetupFlow> & {
  selectablePresets?: readonly RulePresetId[];
  showShellySelector?: boolean;
  onEditSaved?: () => void;
};

export const RuleSetupPage = ({
  flow,
  selectablePresets = ALL_RULE_PRESETS,
  showShellySelector = true,
  onEditSaved
}: RuleSetupPageProps) => {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<RuleDialogState>('none');
  const { dismissToast, pushToast, toasts } = useToastQueue('rule-toast');
  useSavedSensorLiveScanLifecycle({
    flow,
    enabled: flow.sensorDevices.length > 0
  });
  const sensorLiveReadings = useRuleSensorReadings({
    sensorDevices: flow.sensorDevices,
    samplesBySensorId: flow.sensorSamplesById,
    inheritedSensorIds: flow.inheritedSensorIds,
    preferredShellyBaseUrl: flow.selectedShelly?.baseUrl
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
  useEffect(() => {
    if (!flow.installMutation.isSuccess || !flow.isEditingClimateAutomation) return;
    pushToast('ok', t('hardware.rule.editSaved'));
    flow.installMutation.reset();
    onEditSaved?.();
  }, [flow.installMutation, flow.isEditingClimateAutomation, onEditSaved, pushToast, t]);

  const confirmLoadScriptFromShelly = () => {
    if (!flow.selectedShelly) {
      return;
    }
    setDialog('none');
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

  const controlDirection =
    flow.configState.ok && flow.configState.config.rule.mode === flow.rulePreset
      ? flow.configState.config.rule.control.direction
      : undefined;

  return (
    <section className="demo-panel" aria-label={t('hardware.nav.ruleTitle')}>
      {flow.isEditingClimateAutomation && flow.selectedShelly && (
        <div className="rule-edit-context">
          <span className="rule-edit-context__label">
            {t('hardware.rule.editContextLabel')}
          </span>
          <strong>{flow.selectedShelly.name}</strong>
          <p>{t('hardware.rule.editContextHint')}</p>
        </div>
      )}
      <ClimateRuleEditor
        selectablePresets={selectablePresets}
        showShellySelector={showShellySelector}
        shellyDevices={flow.shellyDevices}
        selectedShellyId={flow.selectedShellyId}
        selectedShellyName={flow.selectedShelly?.name}
        hasSelectedShelly={flow.selectedShelly !== null}
        selectShellyDevice={flow.selectShellyDevice}
        sensorDevices={flow.sensorDevices}
        selectedSensorId={flow.selectedSensorId}
        selectedSensorName={flow.selectedSensor?.name}
        additionalSensorIds={flow.additionalSensorIds}
        sensorAggregation={flow.sensorAggregation}
        sensorLiveReadings={sensorLiveReadings}
        selectSensorDevice={flow.selectSensorDevice}
        toggleAdditionalSensorDevice={flow.toggleAdditionalSensorDevice}
        setSensorAggregation={flow.setSensorAggregation}
        rulePreset={flow.rulePreset}
        controlDirection={controlDirection}
        setRulePreset={flow.setRulePreset}
        onThresholdInput={flow.onThresholdInput}
        setOnThresholdInput={flow.setOnThresholdInput}
        offThresholdInput={flow.offThresholdInput}
        setOffThresholdInput={flow.setOffThresholdInput}
        isThresholdValid={flow.isThresholdValid}
        vpdAssistEnabled={flow.vpdAssistEnabled}
        setVpdAssistEnabled={flow.setVpdAssistEnabled}
        vpdTargetInput={flow.vpdTargetInput}
        setVpdTargetInput={flow.setVpdTargetInput}
        isVpdAssistValid={flow.isVpdAssistValid}
        rssiMinInput={flow.rssiMinInput}
        setRssiMinInput={flow.setRssiMinInput}
        staleTimeoutMinInput={flow.staleTimeoutMinInput}
        setStaleTimeoutMinInput={flow.setStaleTimeoutMinInput}
        minChangeMinInput={flow.minChangeMinInput}
        setMinChangeMinInput={flow.setMinChangeMinInput}
        maxOnHoursInput={flow.maxOnHoursInput}
        setMaxOnHoursInput={flow.setMaxOnHoursInput}
        canPreviewScript={flow.configState.ok}
        loadScriptPending={flow.loadAutomationScriptMutation.isPending}
        openScriptPreview={() => setDialog('script')}
        loadScriptFromShelly={() => setDialog('restore')}
        canInstall={canInstallScript(flow)}
        installPending={flow.installMutation.isPending}
        safeRelayTestPending={flow.safeRelayTestMutation.isPending}
        install={() => flow.installMutation.mutate()}
        submitMode={flow.isEditingClimateAutomation ? 'edit' : 'install'}
      />

      <Modal
        actions={
          <button
            className="primary-action"
            type="button"
            disabled={flow.loadAutomationScriptMutation.isPending}
            onClick={confirmLoadScriptFromShelly}
          >
            {t('hardware.rule.restoreFromShellyConfirm')}
          </button>
        }
        closeLabel={t('common.cancel')}
        description={flow.selectedShelly?.name ?? ''}
        open={dialog === 'restore' && flow.selectedShelly !== null}
        title={t('hardware.rule.restoreFromShellyTitle')}
        onClose={() => setDialog('none')}
      >
        <p>{t('hardware.rule.restoreFromShellyDescription')}</p>
      </Modal>
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
      <AppToastViewport
        dismissLabel={t('toast.dismiss')}
        label={t('toast.regionLabel')}
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </section>
  );
};
