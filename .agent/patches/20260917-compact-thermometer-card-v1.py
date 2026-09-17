from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, count))

path = 'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx'
replace(
    path,
    """import {\n  IconClock,\n  IconDeviceMobile,\n""",
    """import {\n  IconBattery,\n  IconClock,\n  IconDeviceMobile,\n"""
)
replace(
    path,
    """  IconPlug,\n  IconPlus,\n  IconTrash\n""",
    """  IconPlug,\n  IconPlus,\n  IconTrash,\n  IconWifi\n"""
)
old = """              <dl className=\"sensor-card-details\">\n                <div>\n                  <dt>{t('hardware.sensor.typeLabel')}</dt>\n                  <dd>{sensorProfileDisplayLabels[device.profileId]}</dd>\n                </div>\n                <div>\n                  <dt>{t('hardware.metrics.battery')}</dt>\n                  <dd>{formatBattery(batterySample, t('common.missingData'))}</dd>\n                </div>\n                <div>\n                  <dt>{t('common.rssi')}</dt>\n                  <dd>\n                    {formatNullableMetric(\n                      rssiSample?.rssi,\n                      ' dBm',\n                      0,\n                      t('common.missingData')\n                    )}\n                  </dd>\n                </div>\n                <div>\n                  <dt>{t('hardware.metrics.lastMeasurement')}</dt>\n                  <dd>{formatSeenAt(latest, locale, t('common.missingData'))}</dd>\n                </div>\n                <div className=\"sensor-card-details__wide\">\n                  <dt>MAC</dt>\n                  <dd>{device.runtimeAddress}</dd>\n                </div>\n              </dl>\n"""
new = """              <div className=\"sensor-status-strip\">\n                <span\n                  className=\"sensor-status-strip__item\"\n                  aria-label={`${t('hardware.metrics.battery')}: ${formatBattery(\n                    batterySample,\n                    '—'\n                  )}`}\n                  title={t('hardware.metrics.battery')}\n                >\n                  <IconBattery aria-hidden=\"true\" />\n                  <strong>{formatBattery(batterySample, '—')}</strong>\n                </span>\n                <span\n                  className=\"sensor-status-strip__item\"\n                  aria-label={`${t('common.rssi')}: ${formatNullableMetric(\n                    rssiSample?.rssi,\n                    ' dBm',\n                    0,\n                    '—'\n                  )}`}\n                  title={t('common.rssi')}\n                >\n                  <IconWifi aria-hidden=\"true\" />\n                  <strong>\n                    {formatNullableMetric(rssiSample?.rssi, ' dBm', 0, '—')}\n                  </strong>\n                </span>\n                <span\n                  className=\"sensor-status-strip__item\"\n                  aria-label={`${t('hardware.metrics.lastMeasurement')}: ${formatSeenAt(\n                    latest,\n                    locale,\n                    '—'\n                  )}`}\n                  title={t('hardware.metrics.lastMeasurement')}\n                >\n                  <IconClock aria-hidden=\"true\" />\n                  <strong>{formatSeenAt(latest, locale, '—')}</strong>\n                </span>\n              </div>\n              <details className=\"sensor-card-details-disclosure\">\n                <summary>{t('hardware.sensor.details')}</summary>\n                <dl className=\"sensor-card-details\">\n                  <div>\n                    <dt>{t('hardware.sensor.typeLabel')}</dt>\n                    <dd>{sensorProfileDisplayLabels[device.profileId]}</dd>\n                  </div>\n                  <div className=\"sensor-card-details__wide\">\n                    <dt>MAC</dt>\n                    <dd>{device.runtimeAddress}</dd>\n                  </div>\n                </dl>\n              </details>\n"""
replace(path, old, new)

path = 'apps/mobile/src/theme/theme.css'
anchor = """.sensor-data-metric-card--empty .sensor-data-metric-card__value,\n.sensor-data-metric-card__value--empty {\n  color: var(--lcl-color-text-muted);\n  opacity: var(--lcl-opacity-muted);\n}\n"""
addition = anchor + """\n.sensor-status-strip {\n  align-items: center;\n  color: var(--lcl-color-text-muted);\n  display: flex;\n  gap: var(--lcl-spacing-md);\n  justify-content: space-between;\n  min-height: var(--lcl-size-compact-control-min-height);\n  padding-inline: var(--lcl-spacing-xs);\n}\n\n.sensor-status-strip__item {\n  align-items: center;\n  display: inline-flex;\n  font-size: var(--lcl-font-size-sm);\n  gap: var(--lcl-spacing-xs);\n  min-width: 0;\n  white-space: nowrap;\n}\n\n.sensor-status-strip__item svg {\n  flex: 0 0 auto;\n  height: var(--lcl-size-control-icon-size);\n  width: var(--lcl-size-control-icon-size);\n}\n\n.sensor-status-strip__item strong {\n  color: var(--lcl-color-text);\n  font-variant-numeric: tabular-nums;\n  font-weight: var(--lcl-font-weight-semibold);\n}\n\n.sensor-card-details-disclosure {\n  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);\n  padding-top: var(--lcl-spacing-xs);\n}\n\n.sensor-card-details-disclosure > summary {\n  color: var(--lcl-color-text-muted);\n  cursor: pointer;\n  font-size: var(--lcl-font-size-sm);\n  font-weight: var(--lcl-font-weight-semibold);\n  list-style: none;\n  padding: var(--lcl-spacing-sm) var(--lcl-spacing-xl) var(--lcl-spacing-sm) 0;\n  position: relative;\n}\n\n.sensor-card-details-disclosure > summary::-webkit-details-marker {\n  display: none;\n}\n\n.sensor-card-details-disclosure > summary::after {\n  border-bottom: var(--lcl-border-width-md) solid var(--lcl-color-text-muted);\n  border-right: var(--lcl-border-width-md) solid var(--lcl-color-text-muted);\n  content: '';\n  height: var(--lcl-size-select-indicator-size);\n  position: absolute;\n  right: var(--lcl-spacing-xs);\n  top: 50%;\n  transform: translateY(-65%) rotate(45deg);\n  width: var(--lcl-size-select-indicator-size);\n}\n\n.sensor-card-details-disclosure[open] > summary::after {\n  transform: translateY(-35%) rotate(225deg);\n}\n\n.sensor-card-details-disclosure .sensor-card-details {\n  margin-top: var(--lcl-spacing-xs);\n}\n\n@media (max-width: 23rem) {\n  .sensor-status-strip {\n    gap: var(--lcl-spacing-sm);\n  }\n\n  .sensor-status-strip__item {\n    font-size: var(--lcl-font-size-xs);\n  }\n}\n"""
replace(path, anchor, addition)

labels = {
    'pl.ts': 'Szczegóły',
    'en.ts': 'Details',
    'de.ts': 'Details',
    'es.ts': 'Detalles',
    'fr.ts': 'Détails',
    'it.ts': 'Dettagli',
    'ptBr.ts': 'Detalhes',
}
for filename, label in labels.items():
    p = Path('apps/mobile/src/app/locales') / filename
    text = p.read_text()
    marker = "      typeLabel:"
    idx = text.find(marker)
    if idx < 0:
        raise SystemExit(f'typeLabel missing in {filename}')
    line_start = text.rfind('\n', 0, idx) + 1
    text = text[:line_start] + f"      details: '{label}',\n" + text[line_start:]
    p.write_text(text)
