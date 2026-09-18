from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)

presentation = Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPresentation.tsx')
text = presentation.read_text()
text = replace_once(
    text,
    """  const temperatureSample = latestNumericSample(samples, 'temperatureC');
  const humiditySample = latestNumericSample(samples, 'humidityPct');
  const latest = latestSample(samples);
  const batterySample = latestBatterySample(samples);
  const rssiSample = latestNumericSample(samples, 'rssi');
""",
    """  const phoneSamples = samples.filter((sample) => sample.source === 'phone-scan');
  const temperatureSample = latestNumericSample(phoneSamples, 'temperatureC');
  const humiditySample = latestNumericSample(phoneSamples, 'humidityPct');
  const latest = latestSample(phoneSamples);
  const batterySample = latestBatterySample(phoneSamples);
  const rssiSample = latestNumericSample(phoneSamples, 'rssi');
""",
    'phone-only fallback samples'
)
text = replace_once(
    text,
    """            ) : latest?.source === 'phone-scan' ? (
              <span
                className="sensor-card-source"
                title={t('hardware.sensor.scanPhoneTitle')}
              >
                <IconDeviceMobile className="icon-action__svg" aria-hidden="true" />
              </span>
            ) : latest?.source === 'shelly-scan' ? (
              <span className="sensor-card-source" title={t('hardware.nav.shellyTitle')}>
                <IconPlug className="icon-action__svg" aria-hidden="true" />
              </span>
            ) : null}
""",
    """            ) : latest ? (
              <span
                className="sensor-card-source"
                title={t('hardware.sensor.scanPhoneTitle')}
              >
                <IconDeviceMobile className="icon-action__svg" aria-hidden="true" />
              </span>
            ) : null}
""",
    'runtime source icon precedence'
)
presentation.write_text(text)

presentation_test = Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPresentation.test.tsx')
text = presentation_test.read_text()
insert_before = "  it('pulses only when seenAtMs strictly advances', () => {\n"
if text.count(insert_before) != 1:
    raise SystemExit('presentation test insertion point missing')
extra = """  it('does not treat a Shelly discovery sample as installed runtime data', () => {
    const shellyDiscoverySample: SensorReadingSample = {
      ...sample(1000),
      source: 'shelly-scan'
    };
    const { container } = render(card([shellyDiscoverySample]));
    const metrics = container.querySelector('.sensor-card-live-values__metrics');

    expect(metrics).toHaveTextContent('— °C · — % · — kPa');
    expect(container.querySelector('.sensor-card-live-values .tabler-icon-plug')).toBeNull();
    expect(
      container.querySelector('.sensor-card-live-values .tabler-icon-device-mobile')
    ).toBeNull();
  });

"""
text = text.replace(insert_before, extra + insert_before, 1)
presentation_test.write_text(text)

hardware_test = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = hardware_test.read_text()
legacy_saved_discovery = "    expect(screen.getByText(/^31\\.2 °C ·/)).toBeInTheDocument();\n"
if text.count(legacy_saved_discovery) != 1:
    raise SystemExit(
        f'expected one saved Shelly-discovery runtime assertion, found {text.count(legacy_saved_discovery)}'
    )
hardware_test.write_text(text.replace(legacy_saved_discovery, '', 1))

print('Restricted thermometer fallback to phone live scan; Shelly icon now means installed runtime only')
