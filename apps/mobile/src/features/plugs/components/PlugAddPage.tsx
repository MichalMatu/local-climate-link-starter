import { useId, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';

export type PlugScanResultView = {
  baseUrl: string;
  model: string;
  generation: number;
  saved: boolean;
  adding: boolean;
};

type ManualPlugAddProps = {
  name: string;
  url: string;
  valid: boolean;
  nameError: string | undefined;
  urlError: string | undefined;
  pending: boolean;
  disabled: boolean;
  onNameChange(value: string): void;
  onUrlChange(value: string): void;
  onSubmit(onSuccess: () => void): void;
};

type PlugNetworkScanProps = {
  startInput: string;
  endInput: string;
  rangeError: string | null;
  active: boolean;
  success: boolean;
  stopped: boolean;
  results: PlugScanResultView[];
  checkPending: boolean;
  onStartInputChange(value: string): void;
  onEndInputChange(value: string): void;
  onStart(): void;
  onStop(): void;
  onAddResult(baseUrl: string, name: string): void;
};

export type PlugAddPageProps = {
  manual: ManualPlugAddProps;
  scan: PlugNetworkScanProps;
};

export const PlugAddPage = ({ manual, scan }: PlugAddPageProps) => {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<'manual' | 'scan'>('scan');
  const [didSubmitManual, setDidSubmitManual] = useState(false);
  const [didSubmitScan, setDidSubmitScan] = useState(false);
  const [scanResultNames, setScanResultNames] = useState<Record<string, string>>({});
  const manualNameId = useId();
  const manualNameErrorId = useId();
  const manualUrlId = useId();
  const manualUrlErrorId = useId();
  const scanRangeErrorId = useId();
  const showManualErrors = didSubmitManual && !manual.valid;
  const showScanRangeError = didSubmitScan && scan.rangeError !== null;
  const shouldShowEmptyScanResult =
    scan.success && !scan.stopped && scan.results.length === 0;

  const selectSection = (section: 'manual' | 'scan') => {
    if (section === activeSection) return;
    if (activeSection === 'scan' && scan.active) scan.onStop();
    setActiveSection(section);
  };

  const submitManual = () => {
    setDidSubmitManual(true);
    if (!manual.valid) return;
    manual.onSubmit(() => setDidSubmitManual(false));
  };

  const startScan = () => {
    setDidSubmitScan(true);
    if (scan.rangeError) return;
    setScanResultNames({});
    scan.onStart();
  };

  const resultName = (result: PlugScanResultView) =>
    scanResultNames[result.baseUrl] ?? result.model;

  return (
    <div className="device-add-page__body">
      <div
        className="shelly-add-tabs lcl-segmented-control"
        role="tablist"
        aria-label={t('hardware.shelly.add')}
      >
        <button
          className="shelly-add-tabs__tab lcl-segmented-control__item"
          type="button"
          role="tab"
          aria-selected={activeSection === 'scan'}
          onClick={() => selectSection('scan')}
        >
          {t('hardware.shelly.scanNetwork')}
        </button>
        <button
          className="shelly-add-tabs__tab lcl-segmented-control__item"
          type="button"
          role="tab"
          aria-selected={activeSection === 'manual'}
          onClick={() => selectSection('manual')}
        >
          {t('hardware.shelly.addManual')}
        </button>
      </div>

      {activeSection === 'manual' && (
        <section
          className="shelly-manual-add"
          role="tabpanel"
          aria-label={t('hardware.shelly.addManual')}
        >
          <div className="shelly-manual-add__body">
            <div
              className={
                showManualErrors && manual.nameError ? 'field field--invalid' : 'field'
              }
            >
              <label htmlFor={manualNameId}>{t('hardware.shelly.deviceNameLabel')}</label>
              <input
                id={manualNameId}
                aria-describedby={
                  showManualErrors && manual.nameError ? manualNameErrorId : undefined
                }
                aria-invalid={showManualErrors && manual.nameError ? true : undefined}
                type="text"
                value={manual.name}
                onChange={(event) => manual.onNameChange(event.currentTarget.value)}
              />
              {showManualErrors && manual.nameError && (
                <span className="field__error" id={manualNameErrorId}>
                  {manual.nameError}
                </span>
              )}
            </div>
            <div
              className={
                showManualErrors && manual.urlError ? 'field field--invalid' : 'field'
              }
            >
              <label htmlFor={manualUrlId}>
                {t('hardware.shelly.addressInputLabel')}
              </label>
              <input
                id={manualUrlId}
                aria-describedby={
                  showManualErrors && manual.urlError ? manualUrlErrorId : undefined
                }
                aria-invalid={showManualErrors && manual.urlError ? true : undefined}
                type="url"
                inputMode="url"
                placeholder={t('hardware.shelly.addressPlaceholder')}
                value={manual.url}
                onChange={(event) => manual.onUrlChange(event.currentTarget.value)}
              />
              {showManualErrors && manual.urlError && (
                <span className="field__error" id={manualUrlErrorId}>
                  {manual.urlError}
                </span>
              )}
            </div>
            <div className="shelly-manual-add__actions">
              <button
                className="primary-action"
                type="button"
                aria-busy={manual.pending || undefined}
                disabled={manual.disabled}
                title={t('hardware.shelly.addCheckedTitle')}
                onClick={submitManual}
              >
                {manual.pending ? t('hardware.shelly.checking') : t('common.add')}
              </button>
            </div>
          </div>
        </section>
      )}

      {activeSection === 'scan' && (
        <section
          className="shelly-network-scan"
          role="tabpanel"
          aria-label={t('hardware.shelly.scanNetwork')}
        >
          <div className="shelly-network-scan__body">
            <div className="shelly-network-scan__range">
              <label className={showScanRangeError ? 'field field--invalid' : 'field'}>
                {t('hardware.shelly.scanRangeStart')}
                <input
                  aria-describedby={showScanRangeError ? scanRangeErrorId : undefined}
                  aria-invalid={showScanRangeError}
                  type="text"
                  inputMode="numeric"
                  placeholder="192.168.0.1"
                  value={scan.startInput}
                  onChange={(event) => scan.onStartInputChange(event.currentTarget.value)}
                />
              </label>
              <label className={showScanRangeError ? 'field field--invalid' : 'field'}>
                {t('hardware.shelly.scanRangeEnd')}
                <input
                  aria-describedby={showScanRangeError ? scanRangeErrorId : undefined}
                  aria-invalid={showScanRangeError}
                  type="text"
                  inputMode="numeric"
                  placeholder="192.168.0.99"
                  value={scan.endInput}
                  onChange={(event) => scan.onEndInputChange(event.currentTarget.value)}
                />
                {showScanRangeError && (
                  <span className="field__error" id={scanRangeErrorId}>
                    {scan.rangeError}
                  </span>
                )}
              </label>
            </div>

            {shouldShowEmptyScanResult && <p>{t('hardware.shelly.scanResultEmpty')}</p>}
            {scan.results.length > 0 && (
              <div
                className="saved-list"
                aria-label={t('hardware.shelly.foundListLabel')}
              >
                {scan.results.map((result) => {
                  const name = resultName(result);
                  return (
                    <article
                      key={result.baseUrl}
                      className="device-discovery-card shelly-scan-result"
                    >
                      <div className="device-discovery-card__primary">
                        <label className="device-discovery-card__name">
                          <span>{t('hardware.shelly.deviceNameLabel')}</span>
                          <input
                            className="device-discovery-card__name-input shelly-scan-result__name-input"
                            aria-label={`${t('hardware.shelly.deviceNameLabel')}: ${result.baseUrl}`}
                            type="text"
                            value={name}
                            disabled={result.saved}
                            onChange={(event) =>
                              setScanResultNames((current) => ({
                                ...current,
                                [result.baseUrl]: event.currentTarget.value
                              }))
                            }
                          />
                        </label>
                        <button
                          aria-label={
                            result.saved
                              ? `${t('hardware.shelly.alreadyAdded')}: ${result.baseUrl}`
                              : `${t('common.add')}: ${result.baseUrl}`
                          }
                          aria-busy={result.adding || undefined}
                          className="primary-action device-discovery-card__action shelly-scan-result__add"
                          type="button"
                          disabled={
                            result.saved || scan.checkPending || name.trim().length === 0
                          }
                          onClick={() => scan.onAddResult(result.baseUrl, name)}
                        >
                          {result.saved
                            ? t('hardware.shelly.alreadyAdded')
                            : result.adding
                              ? t('hardware.shelly.checking')
                              : t('common.add')}
                        </button>
                      </div>
                      <div className="device-discovery-card__meta shelly-scan-result__meta">
                        <strong className="device-discovery-card__identity">
                          {result.baseUrl}
                        </strong>
                        <span>
                          {result.model}, gen {result.generation}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="action-row shelly-network-scan__actions device-add-page__scan-control">
              <button
                className="secondary-action device-scan-action"
                type="button"
                aria-busy={scan.active || undefined}
                title={
                  scan.active
                    ? t('hardware.shelly.scanStopTitle')
                    : t('hardware.shelly.scanStartTitle')
                }
                onClick={scan.active ? scan.onStop : startScan}
              >
                {scan.active && (
                  <span className="device-scan-action__spinner" aria-hidden="true" />
                )}
                <span>
                  {scan.active
                    ? t('hardware.shelly.scanStop')
                    : t('hardware.shelly.scanStart')}
                </span>
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
