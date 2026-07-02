import {
  DiagnosticRow,
  FeedbackPanel,
  Modal,
  RuleSummaryCard,
  SensorCard,
  ShellyCard,
  StatusBadge,
  ToastViewport,
  type ToastMessage,
  type ToastTone
} from '@lcl/ui';
import { useTranslation, type Translate, type TranslationKey } from '../app/i18n.js';
import { useDemoSetupFlow } from '../flows/demo/useDemoSetupFlow.js';
import type { ShellyComponentState } from '@lcl/shelly-client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

const formatComponentState = (state: ShellyComponentState, t: Translate): string => {
  switch (state) {
    case 'enabled':
      return t('common.enabled');
    case 'disabled':
      return t('common.disabled');
    case 'missing':
      return t('common.missingInStatus');
  }
};

const formatMaybeNumber = (
  value: number | undefined,
  suffix: string,
  missingLabel: string,
  fractionDigits = 1
): string =>
  value === undefined ? missingLabel : `${value.toFixed(fractionDigits)}${suffix}`;

export const DemoWizardScreen = () => {
  const { t } = useTranslation();
  const flow = useDemoSetupFlow();
  const selectedMeasurement = flow.selectedSensor.measurement;
  const thresholdErrorId = useId();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isMatterBlockModalOpen, setIsMatterBlockModalOpen] = useState(false);
  const toastIdRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((tone: ToastTone, title: string, detail?: string) => {
    toastIdRef.current += 1;
    const id = `demo-toast-${toastIdRef.current}`;
    const toast: ToastMessage =
      detail === undefined ? { id, tone, title } : { id, tone, title, detail };
    setToasts((current) => [...current.slice(-2), toast]);
  }, []);

  useEffect(() => {
    if (!flow.matterBlockedVisible) {
      setIsMatterBlockModalOpen(false);
      return;
    }
    setIsMatterBlockModalOpen(true);
  }, [flow.matterBlockedVisible]);

  useEffect(() => {
    if (!flow.installMutation.isError) {
      return;
    }
    pushToast('warning', t('demo.uploadFailed'));
    flow.installMutation.reset();
  }, [flow.installMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.relayMutation.isError) {
      return;
    }
    pushToast('warning', t('demo.relayFailed'));
    flow.relayMutation.reset();
  }, [flow.relayMutation, pushToast, t]);

  return (
    <main className="demo-shell">
      <header className="demo-header">
        <div>
          <p className="demo-kicker">
            {t(`demo.section.${flow.step}` as TranslationKey)}
          </p>
          <h1>{t('app.promise')}</h1>
          <p>{t('app.promiseDetail')}</p>
        </div>
        <StatusBadge tone={flow.relayFinalOff ? 'ok' : 'inactive'}>demo</StatusBadge>
      </header>

      {flow.step === 'start' && (
        <section className="demo-panel">
          <h2>{t('demo.startSetup')}</h2>
          <p>{t('hardware.safety.heatingDefaultOff')}</p>
          <p>{t('demo.usePhoneSetupOnly')}</p>
          <button
            className="primary-action"
            type="button"
            title={t('demo.startTitle')}
            onClick={flow.start}
          >
            {t('demo.addKit')}
          </button>
        </section>
      )}

      {flow.step === 'sensor' && (
        <section className="demo-panel">
          <div className="panel-heading">
            <div>
              <h2>{t('hardware.sensor.add')}</h2>
              <p>
                {flow.sensorState === 'empty'
                  ? t('demo.emptySensors')
                  : t('demo.loadingSensors')}
              </p>
            </div>
            <button
              className="secondary-action"
              type="button"
              title={t('demo.scanTitle')}
              onClick={flow.scanSensors}
            >
              {t('demo.scan')}
            </button>
          </div>
          {flow.sensorState === 'loading' && <p>{t('demo.loadingReadings')}</p>}
          {flow.sensorState === 'success' && (
            <div className="card-grid">
              {flow.sensors.map((sensor) => (
                <button
                  className="select-card"
                  type="button"
                  key={sensor.measurement.sensorId}
                  aria-pressed={flow.selectedSensorProfileId === sensor.profileId}
                  title={t('demo.selectSensorTitle')}
                  onClick={() => flow.setSelectedSensorProfileId(sensor.profileId)}
                >
                  <SensorCard
                    name={
                      sensor.profileId === 'tp357_custom_v1'
                        ? 'TP357 demo'
                        : 'Xiaomi LYWSD03MMC'
                    }
                    profileLabel={sensor.rawKind}
                    statusLabel={
                      sensor.profileId === 'tp357_custom_v1'
                        ? 'demo'
                        : t('common.compatible')
                    }
                    metrics={[
                      {
                        label: t('hardware.metrics.temperature'),
                        value: formatMaybeNumber(
                          sensor.measurement.temperatureC,
                          '°C',
                          t('common.missing')
                        )
                      },
                      {
                        label: t('hardware.metrics.humidity'),
                        value: formatMaybeNumber(
                          sensor.measurement.humidityPct,
                          '%',
                          t('common.missing')
                        )
                      },
                      {
                        label: t('hardware.metrics.battery'),
                        value:
                          sensor.measurement.batteryPct === undefined
                            ? t('common.missing')
                            : `${sensor.measurement.batteryPct}%`
                      },
                      {
                        label: 'RSSI',
                        value:
                          sensor.measurement.rssi === undefined
                            ? t('common.missing')
                            : `${sensor.measurement.rssi} dBm`
                      }
                    ]}
                  />
                </button>
              ))}
            </div>
          )}
          <div className="action-row">
            <button
              className="primary-action"
              type="button"
              disabled={flow.sensorState !== 'success'}
              title={t('hardware.shelly.checkTitle')}
              onClick={() => flow.setStep('shelly')}
            >
              {t('hardware.shelly.add')}
            </button>
          </div>
        </section>
      )}

      {flow.step === 'shelly' && (
        <section className="demo-panel">
          <div className="panel-heading">
            <div>
              <h2>{t('hardware.shelly.add')}</h2>
              <p>{t('demo.usePhoneSetupOnly')}</p>
            </div>
            <button
              className="secondary-action"
              type="button"
              title={t('demo.checkCompatibilityTitle')}
              onClick={flow.checkShelly}
            >
              {t('demo.checkCompatibility')}
            </button>
          </div>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={flow.matterBlockedScenario}
              onChange={(event) =>
                flow.setMatterBlockedScenario(event.currentTarget.checked)
              }
            />
            <span>{t('demo.matterScenario')}</span>
          </label>
          {flow.shellyState === 'loading' && <p>{t('demo.loadingShelly')}</p>}
          {flow.shellyState === 'success' && (
            <>
              <ShellyCard
                name="Shelly Plug S Gen3"
                model="Fake Shelly demo"
                badgeLabel={
                  flow.shellyStatus?.matterEnabled
                    ? t('hardware.status.blocked')
                    : t('hardware.status.compatible')
                }
                badgeTone={flow.shellyStatus?.matterEnabled ? 'danger' : 'ok'}
                rows={[
                  {
                    label: 'Scripts',
                    value: formatComponentState(
                      flow.shellyStatus?.scripts ?? 'missing',
                      t
                    )
                  },
                  {
                    label: 'Bluetooth',
                    value: formatComponentState(
                      flow.shellyStatus?.bluetooth ?? 'missing',
                      t
                    )
                  },
                  {
                    label: 'Matter',
                    value: flow.shellyStatus?.matterEnabled
                      ? t('common.enabled')
                      : t('common.disabled')
                  }
                ]}
              />
            </>
          )}
          <Modal
            closeLabel={t('common.close')}
            open={isMatterBlockModalOpen && flow.step === 'shelly'}
            title={t('demo.blockedInstall')}
            onClose={() => setIsMatterBlockModalOpen(false)}
          >
            <FeedbackPanel tone="danger" title={t('hardware.safety.matterBlocked')}>
              {t('hardware.safety.turnMatterOff')}
            </FeedbackPanel>
          </Modal>
          <div className="action-row">
            <button
              className="primary-action"
              type="button"
              disabled={flow.shellyState !== 'success' || flow.matterBlockedVisible}
              title={t('hardware.rule.setThreshold')}
              onClick={() => flow.setStep('rule')}
            >
              {t('hardware.rule.setThreshold')}
            </button>
          </div>
        </section>
      )}

      {flow.step === 'rule' && (
        <section className="demo-panel">
          <h2>{t('hardware.rule.setThreshold')}</h2>
          <div className="reading-strip">
            <span>{t('hardware.rule.selectedSensor')}</span>
            <strong>{selectedMeasurement.temperatureC?.toFixed(1)}°C</strong>
            <span>{selectedMeasurement.humidityPct?.toFixed(0)}%</span>
          </div>
          <label className={flow.isThresholdValid ? 'field' : 'field field--invalid'}>
            {t('hardware.rule.thresholdOnBelowC')}
            <input
              aria-describedby={flow.isThresholdValid ? undefined : thresholdErrorId}
              aria-invalid={!flow.isThresholdValid}
              type="number"
              step="0.1"
              value={flow.onThreshold}
              onChange={(event) => flow.setOnThreshold(Number(event.currentTarget.value))}
            />
          </label>
          <label className={flow.isThresholdValid ? 'field' : 'field field--invalid'}>
            {t('hardware.rule.thresholdOffAboveC')}
            <input
              aria-describedby={flow.isThresholdValid ? undefined : thresholdErrorId}
              aria-invalid={!flow.isThresholdValid}
              type="number"
              step="0.1"
              value={flow.offThreshold}
              onChange={(event) =>
                flow.setOffThreshold(Number(event.currentTarget.value))
              }
            />
            {!flow.isThresholdValid && (
              <span className="field__error" id={thresholdErrorId}>
                {t('hardware.rule.thresholdInvalid')}
              </span>
            )}
          </label>
          <RuleSummaryCard
            title={t('hardware.rule.summaryTitle')}
            summary={t('hardware.rule.summary', {
              action: t('hardware.rule.preset.heating'),
              onComparator: t('hardware.rule.comparator.below'),
              onThreshold: flow.onThreshold.toFixed(1),
              offComparator: t('hardware.rule.comparator.above'),
              offThreshold: flow.offThreshold.toFixed(1),
              unit: '°C',
              sensor: t('hardware.rule.summarySensorDefault'),
              staleTimeoutMin: 15,
              shelly: t('hardware.rule.summaryShellyDefault'),
              maxOnHours: 4,
              minChangeMin: 2,
              vpd: '',
              rssi: ''
            })}
          />
          <button
            className="primary-action"
            type="button"
            disabled={!flow.isThresholdValid}
            title={t('hardware.rule.scriptPreviewTitle')}
            onClick={() => flow.setStep('script')}
          >
            {t('hardware.rule.scriptPreviewAria')}
          </button>
        </section>
      )}

      {flow.step === 'script' && (
        <section className="demo-panel">
          <h2>{t('hardware.rule.scriptPreview')}</h2>
          <p>{t('hardware.safety.heatingDefaultOff')}</p>
          <pre className="script-preview" aria-label={t('hardware.rule.scriptPreview')}>
            {flow.script}
          </pre>
          <button
            className="primary-action"
            type="button"
            title={t('demo.installTitle')}
            onClick={() => flow.setStep('install')}
          >
            {t('demo.install')}
          </button>
        </section>
      )}

      {flow.step === 'install' && (
        <section className="demo-panel">
          <h2>{t('demo.fakeUpload')}</h2>
          <p>{t('demo.noRealLan')}</p>
          <button
            className="primary-action"
            type="button"
            aria-busy={flow.installMutation.isPending}
            disabled={flow.installMutation.isPending}
            title={t('demo.installScriptTitle')}
            onClick={() => flow.installMutation.mutate()}
          >
            {flow.installMutation.isPending
              ? t('common.sending')
              : t('demo.installScript')}
          </button>
        </section>
      )}

      {flow.step === 'relay' && (
        <section className="demo-panel">
          <h2>{t('common.test')}</h2>
          <p>{t('hardware.safety.noHeater')}</p>
          <button
            className="primary-action"
            type="button"
            aria-busy={flow.relayMutation.isPending}
            disabled={flow.relayMutation.isPending}
            title={t('hardware.rule.relayTestTitleAttr')}
            onClick={() => flow.relayMutation.mutate()}
          >
            {flow.relayMutation.isPending ? t('common.testing') : t('common.test')}
          </button>
        </section>
      )}

      {flow.step === 'done' && (
        <section className="demo-panel">
          <h2>{t('hardware.ready')}</h2>
          <p>
            {flow.relayFinalOff
              ? t('hardware.rule.relayTestDone')
              : t('demo.relayFailed')}
          </p>
          <div className="status-stack">
            <DiagnosticRow
              label={t('hardware.metrics.mode')}
              value={t('demo.statusModeDemo')}
            />
            <DiagnosticRow
              label={t('hardware.metrics.thermometer')}
              value={flow.selectedSensorProfileId}
            />
            <DiagnosticRow
              label={t('demo.statusRuntimeAddress')}
              value={`${flow.runtimeAddress} (${t('demo.statusRuntimeSuffix')})`}
            />
            <DiagnosticRow
              label={t('hardware.rule.script')}
              value={t('demo.statusScriptDemo')}
            />
            <DiagnosticRow
              label={t('hardware.metrics.relay')}
              value={
                flow.relayFinalOff
                  ? 'OFF'
                  : t('hardware.diagnostics.scriptMissingConfirm')
              }
              tone={flow.relayFinalOff ? 'normal' : 'danger'}
            />
          </div>
          <h3>{t('common.diagnostics')}</h3>
          <pre className="support-summary">{flow.supportSummary}</pre>
        </section>
      )}
      <ToastViewport
        dismissLabel={t('toast.dismiss')}
        label={t('toast.regionLabel')}
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </main>
  );
};
