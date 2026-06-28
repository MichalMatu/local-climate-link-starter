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
import { t } from '../app/i18n.js';
import { useDemoSetupFlow } from '../flows/demo/useDemoSetupFlow.js';
import type { ShellyComponentState } from '@lcl/shelly-client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

const sectionTitle: Record<string, string> = {
  start: 'Start',
  sensor: 'Czujniki',
  shelly: 'Gniazdko',
  rule: 'Reguła',
  script: 'Skrypt',
  install: 'Instalacja',
  relay: 'Test',
  done: 'Status'
};

const formatComponentState = (state: ShellyComponentState): string => {
  switch (state) {
    case 'enabled':
      return 'włączone';
    case 'disabled':
      return 'wyłączone';
    case 'missing':
      return 'brak w statusie';
  }
};

const formatMaybeNumber = (
  value: number | undefined,
  suffix: string,
  fractionDigits = 1
): string => (value === undefined ? 'brak' : `${value.toFixed(fractionDigits)}${suffix}`);

export const DemoWizardScreen = () => {
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
  }, [flow.installMutation, pushToast]);

  useEffect(() => {
    if (!flow.relayMutation.isError) {
      return;
    }
    pushToast('warning', t('demo.relayFailed'));
    flow.relayMutation.reset();
  }, [flow.relayMutation, pushToast]);

  return (
    <main className="demo-shell">
      <header className="demo-header">
        <div>
          <p className="demo-kicker">{sectionTitle[flow.step]}</p>
          <h1>{t('app.promise')}</h1>
          <p>{t('app.promiseDetail')}</p>
        </div>
        <StatusBadge tone={flow.relayFinalOff ? 'ok' : 'inactive'}>demo</StatusBadge>
      </header>

      {flow.step === 'start' && (
        <section className="demo-panel">
          <h2>Skonfiguruj lokalny termostat</h2>
          <p>{t('hardware.safety.heatingDefaultOff')}</p>
          <p>
            Telefon pomaga tylko w konfiguracji. Po instalacji Shelly działa lokalnie.
          </p>
          <button
            className="primary-action"
            type="button"
            title="Rozpocznij konfigurację przykładowego zestawu"
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
              title="Wczytaj przykładowe odczyty BLE"
              onClick={flow.scanSensors}
            >
              Skanuj demo
            </button>
          </div>
          {flow.sensorState === 'loading' && <p>Ładowanie odczytów demo.</p>}
          {flow.sensorState === 'success' && (
            <div className="card-grid">
              {flow.sensors.map((sensor) => (
                <button
                  className="select-card"
                  type="button"
                  key={sensor.measurement.sensorId}
                  aria-pressed={flow.selectedSensorProfileId === sensor.profileId}
                  title="Wybierz ten termometr do reguły demo"
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
                      sensor.profileId === 'tp357_custom_v1' ? 'symulacja' : 'zgodne'
                    }
                    metrics={[
                      {
                        label: 'Temperatura',
                        value: formatMaybeNumber(sensor.measurement.temperatureC, '°C')
                      },
                      {
                        label: 'Wilgotność',
                        value: formatMaybeNumber(sensor.measurement.humidityPct, '%')
                      },
                      {
                        label: 'Bateria',
                        value:
                          sensor.measurement.batteryPct === undefined
                            ? 'brak'
                            : `${sensor.measurement.batteryPct}%`
                      },
                      {
                        label: 'RSSI',
                        value:
                          sensor.measurement.rssi === undefined
                            ? 'brak'
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
              title="Przejdź do sprawdzenia gniazdka Shelly"
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
              <p>Sprawdzam kompatybilność bez połączenia z prawdziwym urządzeniem.</p>
            </div>
            <button
              className="secondary-action"
              type="button"
              title="Sprawdź przykładową kompatybilność Shelly"
              onClick={flow.checkShelly}
            >
              Sprawdź demo
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
            <span>Scenariusz demo: Matter ON</span>
          </label>
          {flow.shellyState === 'loading' && <p>Sprawdzam gniazdko demo.</p>}
          {flow.shellyState === 'success' && (
            <>
              <ShellyCard
                name="Shelly Plug S Gen3"
                model="Fake Shelly demo"
                badgeLabel={flow.shellyStatus?.matterEnabled ? 'blokada' : 'zgodne'}
                badgeTone={flow.shellyStatus?.matterEnabled ? 'danger' : 'ok'}
                rows={[
                  {
                    label: 'Scripts',
                    value: formatComponentState(flow.shellyStatus?.scripts ?? 'missing')
                  },
                  {
                    label: 'Bluetooth',
                    value: formatComponentState(flow.shellyStatus?.bluetooth ?? 'missing')
                  },
                  {
                    label: 'Matter',
                    value: flow.shellyStatus?.matterEnabled ? 'włączony' : 'wyłączony'
                  }
                ]}
              />
            </>
          )}
          <Modal
            closeLabel="Zamknij"
            open={isMatterBlockModalOpen && flow.step === 'shelly'}
            title="Instalacja zablokowana"
            onClose={() => setIsMatterBlockModalOpen(false)}
          >
            <FeedbackPanel tone="danger" title={t('hardware.safety.matterBlocked')}>
              Wyłącz Matter w Shelly i sprawdź gniazdko ponownie.
            </FeedbackPanel>
          </Modal>
          <div className="action-row">
            <button
              className="primary-action"
              type="button"
              disabled={flow.shellyState !== 'success' || flow.matterBlockedVisible}
              title="Przejdź do ustawienia progów reguły"
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
            <span>Wybrany czujnik</span>
            <strong>{selectedMeasurement.temperatureC?.toFixed(1)}°C</strong>
            <span>{selectedMeasurement.humidityPct?.toFixed(0)}%</span>
          </div>
          <label className={flow.isThresholdValid ? 'field' : 'field field--invalid'}>
            Włącz poniżej °C
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
            Wyłącz powyżej °C
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
            title="Podsumowanie reguły"
            summary={`Grzanie włączy się poniżej ${flow.onThreshold.toFixed(1)}°C i wyłączy powyżej ${flow.offThreshold.toFixed(1)}°C. Gdy termometr zniknie na 15 min albo Shelly uruchomi się ponownie, przekaźnik wyłączy się bezpiecznie. Po świeżym odczycie automatyka znów zastosuje tę regułę. Maksymalny czas pracy: 4 h.`}
          />
          <button
            className="primary-action"
            type="button"
            disabled={!flow.isThresholdValid}
            title="Otwórz podgląd wygenerowanego skryptu demo"
            onClick={() => flow.setStep('script')}
          >
            Pokaż skrypt
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
            title="Przejdź do symulowanej wysyłki skryptu"
            onClick={() => flow.setStep('install')}
          >
            {t('demo.install')}
          </button>
        </section>
      )}

      {flow.step === 'install' && (
        <section className="demo-panel">
          <h2>Fake upload</h2>
          <p>Skrypt trafia do symulowanego Shelly. Prawdziwy LAN nie jest używany.</p>
          <button
            className="primary-action"
            type="button"
            aria-busy={flow.installMutation.isPending}
            disabled={flow.installMutation.isPending}
            title="Wyślij skrypt do symulowanego Shelly"
            onClick={() => flow.installMutation.mutate()}
          >
            {flow.installMutation.isPending ? 'Wysyłam' : 'Wyślij skrypt demo'}
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
            title="Uruchom krótki test przekaźnika demo"
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
            <DiagnosticRow label="Tryb" value="demo bez hardware" />
            <DiagnosticRow label="Czujnik" value={flow.selectedSensorProfileId} />
            <DiagnosticRow
              label="Adres Shelly runtime"
              value={`${flow.runtimeAddress} (symulowany)`}
            />
            <DiagnosticRow label="Skrypt" value="uruchomiony demo" />
            <DiagnosticRow
              label="Przekaźnik"
              value={flow.relayFinalOff ? 'OFF' : 'niepotwierdzony'}
              tone={flow.relayFinalOff ? 'normal' : 'danger'}
            />
          </div>
          <h3>{t('common.diagnostics')}</h3>
          <pre className="support-summary">{flow.supportSummary}</pre>
        </section>
      )}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
};
