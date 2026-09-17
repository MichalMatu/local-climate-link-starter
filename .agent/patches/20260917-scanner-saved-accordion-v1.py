from pathlib import Path
import re


def replace(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, count))


hook = Path('apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.ts')
hook.write_text("""import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { scanShellySetupUrls, type ShellySetupScanOutcome } from './shellyRequests.js';
import { createIpv4RangeScanUrls } from './validation.js';

export const buildShellyScanUrls = (startInput: string, endInput: string): string[] =>
  createIpv4RangeScanUrls(startInput, endInput);

export const useShellySetupScanFlow = () => {
  const [shellyScanStartInput, setShellyScanStartInput] = useState('192.168.0.1');
  const [shellyScanEndInput, setShellyScanEndInput] = useState('192.168.0.254');
  const [shellyScanStopped, setShellyScanStopped] = useState(false);
  const shellyScanAbortControllerRef = useRef<AbortController | null>(null);

  const shellyScanMutation = useMutation({
    mutationFn: async (): Promise<ShellySetupScanOutcome> => {
      setShellyScanStopped(false);
      const controller = new AbortController();
      shellyScanAbortControllerRef.current = controller;
      try {
        const baseUrls = buildShellyScanUrls(shellyScanStartInput, shellyScanEndInput);
        return await scanShellySetupUrls({
          baseUrls,
          signal: controller.signal,
          stopAfterFirst: false
        });
      } finally {
        if (shellyScanAbortControllerRef.current === controller) {
          shellyScanAbortControllerRef.current = null;
        }
      }
    }
  });

  const startShellyScan = () => {
    setShellyScanStopped(false);
    shellyScanMutation.mutate();
  };

  const stopShellyScan = () => {
    const controller = shellyScanAbortControllerRef.current;
    if (!controller || controller.signal.aborted) {
      return false;
    }
    setShellyScanStopped(true);
    controller.abort();
    shellyScanAbortControllerRef.current = null;
    shellyScanMutation.reset();
    return true;
  };

  const resetShellyScan = () => {
    stopShellyScan();
    setShellyScanStopped(false);
    shellyScanMutation.reset();
  };

  return {
    shellyScanStartInput,
    setShellyScanStartInput,
    shellyScanEndInput,
    setShellyScanEndInput,
    shellyScanStopped,
    shellyScanMutation,
    startShellyScan,
    stopShellyScan,
    resetShellyScan
  };
};
""")

replace(
    'apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts',
    '} = useShellySetupScanFlow(shellyDevices);',
    '} = useShellySetupScanFlow();'
)

scan_test = Path('apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.test.ts')
scan_test.write_text("""import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';
import { buildShellyScanUrls, useShellySetupScanFlow } from './useShellySetupScanFlow.js';

describe('Shelly setup scan derivation', () => {
  it('preserves every address in the requested IPv4 range', () => {
    expect(buildShellyScanUrls('192.168.0.1', '192.168.0.3')).toEqual([
      'http://192.168.0.1/',
      'http://192.168.0.2/',
      'http://192.168.0.3/'
    ]);
  });

  it('defaults STA discovery to the full common 192.168.0.x host range', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(() => useShellySetupScanFlow(), { wrapper });

    expect(result.current.shellyScanStartInput).toBe('192.168.0.1');
    expect(result.current.shellyScanEndInput).toBe('192.168.0.254');
    queryClient.clear();
  });

  it('allows an incomplete scan address while the user is editing without crashing render', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(() => useShellySetupScanFlow(), { wrapper });

    act(() => {
      result.current.setShellyScanStartInput('192.168.0.');
    });

    expect(result.current.shellyScanStartInput).toBe('192.168.0.');
    queryClient.clear();
  });
});
""")

page = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx'
replace(
    page,
    "import { countIpv4RangeScanAddresses } from '../../../flows/hardware-setup/validation.js';",
    "import {\n  countIpv4RangeScanAddresses,\n  normalizeShellyUrl\n} from '../../../flows/hardware-setup/validation.js';"
)
replace(
    page,
    "const SHELLY_STA_SCAN_END = '192.168.0.254';\n",
    "const SHELLY_STA_SCAN_END = '192.168.0.254';\n\nconst normalizeScanBaseUrl = (value: string): string => {\n  try {\n    return normalizeShellyUrl(value);\n  } catch {\n    return value.trim().replace(/\\/+$/, '').toLowerCase();\n  }\n};\n"
)
replace(
    page,
    "  const [didSubmitShellyScan, setDidSubmitShellyScan] = useState(false);\n",
    "  const [didSubmitShellyScan, setDidSubmitShellyScan] = useState(false);\n  const [activeAddSection, setActiveAddSection] = useState<'manual' | 'scan' | null>(\n    'manual'\n  );\n"
)
replace(
    page,
    "  const openAddShellyModal = () => {\n    flow.checkShellyMutation.reset();\n    setDidSubmitShellyAdd(false);\n    setDialog({ kind: 'add' });\n  };\n",
    "  const openAddShellyModal = () => {\n    flow.checkShellyMutation.reset();\n    setDidSubmitShellyAdd(false);\n    setActiveAddSection('manual');\n    setDialog({ kind: 'add' });\n  };\n"
)
replace(
    page,
    "    setDidSubmitShellyScan(false);\n    setDialog({ kind: 'none' });\n",
    "    setDidSubmitShellyScan(false);\n    setActiveAddSection('manual');\n    setDialog({ kind: 'none' });\n",
    1
)
replace(
    page,
    "  const stopShellyScan = () => {\n    flow.stopShellyScan();\n  };\n",
    "  const stopShellyScan = () => {\n    flow.stopShellyScan();\n  };\n\n  const toggleAddSection = (section: 'manual' | 'scan') => {\n    const nextSection = activeAddSection === section ? null : section;\n    if (activeAddSection === 'scan' && nextSection !== 'scan' && isShellyScanActive) {\n      flow.stopShellyScan();\n    }\n    setActiveAddSection(nextSection);\n  };\n"
)
replace(
    page,
    "  const openBleScanModal = (device: ShellyDraftDevice) => {\n",
    "  const isSavedShellyScanResult = (result: ShellySetupScanResult) =>\n    shellyDevices.some(\n      (device) => normalizeScanBaseUrl(device.baseUrl) === normalizeScanBaseUrl(result.baseUrl)\n    );\n\n  const openBleScanModal = (device: ShellyDraftDevice) => {\n"
)

manual_old = """        <ShellyAddForm flow={flow} showValidationErrors={didSubmitShellyAdd} />
        <div className="shelly-manual-add__actions">
          <button
            className="primary-action"
            type="button"
            aria-busy={flow.checkShellyMutation.isPending || undefined}
            disabled={isAnyShellyCheckPending}
            title={t('hardware.shelly.addCheckedTitle')}
            onClick={checkShelly}
          >
            {flow.checkShellyMutation.isPending
              ? t('hardware.shelly.checking')
              : t('common.add')}
          </button>
        </div>
        <details className="shelly-network-scan">
          <summary>{t('hardware.shelly.scanNetwork')}</summary>
"""
manual_new = """        <details className="shelly-manual-add" open={activeAddSection === 'manual'}>
          <summary
            onClick={(event) => {
              event.preventDefault();
              toggleAddSection('manual');
            }}
          >
            {t('hardware.shelly.addManual')}
          </summary>
          <div className="shelly-manual-add__body">
            <ShellyAddForm flow={flow} showValidationErrors={didSubmitShellyAdd} />
            <div className="shelly-manual-add__actions">
              <button
                className="primary-action"
                type="button"
                aria-busy={flow.checkShellyMutation.isPending || undefined}
                disabled={isAnyShellyCheckPending}
                title={t('hardware.shelly.addCheckedTitle')}
                onClick={checkShelly}
              >
                {flow.checkShellyMutation.isPending
                  ? t('hardware.shelly.checking')
                  : t('common.add')}
              </button>
            </div>
          </div>
        </details>
        <details className="shelly-network-scan" open={activeAddSection === 'scan'}>
          <summary
            onClick={(event) => {
              event.preventDefault();
              toggleAddSection('scan');
            }}
          >
            {t('hardware.shelly.scanNetwork')}
          </summary>
"""
replace(page, manual_old, manual_new)

scan_button_old = """                      <button
                        aria-label={`${t('common.select')}: ${result.baseUrl}`}
                        className="secondary-action shelly-scan-result__add"
                        type="button"
                        onClick={() => selectScannedShellyDevice(result)}
                      >
                        {t('common.select')}
                      </button>
"""
scan_button_new = """                      <button
                        aria-label={
                          isSavedShellyScanResult(result)
                            ? `${t('hardware.shelly.alreadyAdded')}: ${result.baseUrl}`
                            : `${t('common.select')}: ${result.baseUrl}`
                        }
                        className="secondary-action shelly-scan-result__add"
                        type="button"
                        disabled={isSavedShellyScanResult(result)}
                        onClick={() => selectScannedShellyDevice(result)}
                      >
                        {isSavedShellyScanResult(result)
                          ? t('hardware.shelly.alreadyAdded')
                          : t('common.select')}
                      </button>
"""
replace(page, scan_button_old, scan_button_new)

css = 'apps/mobile/src/theme/theme.css'
replace(
    css,
    '.shelly-network-scan > summary {',
    '.shelly-manual-add > summary,\n.shelly-network-scan > summary {'
)
replace(
    css,
    '.shelly-manual-add__actions {\n',
    '.shelly-manual-add__body {\n  display: grid;\n  gap: var(--lcl-spacing-md);\n  padding-bottom: var(--lcl-spacing-sm);\n}\n\n.shelly-manual-add__actions {\n'
)

locale_values = {
    'pl.ts': ('Dodaj ręcznie', 'Dodane', 'AP: połącz się bezpośrednio z Wi-Fi Shelly — adres to zwykle 192.168.33.1. STA: Shelly jest w Twojej sieci Wi-Fi — użyj zakresu tej sieci. Skan pokazuje także już dodane gniazdka, oznacza je jako Dodane i sprawdza cały wybrany zakres aż do końca albo Stop.', 'Nie znalazłem gniazdka Shelly w tym zakresie.'),
    'en.ts': ('Add manually', 'Added', 'AP: connect directly to Shelly Wi-Fi — the address is usually 192.168.33.1. STA: Shelly is on your Wi-Fi — use that network range. The scan also shows already added plugs, marks them as Added, and checks the full selected range until it finishes or you press Stop.', 'No Shelly plug was found in this range.'),
    'de.ts': ('Manuell hinzufügen', 'Hinzugefügt', 'AP: Direkt mit dem Shelly-WLAN verbinden — die Adresse ist normalerweise 192.168.33.1. STA: Shelly ist in deinem WLAN — verwende den Bereich dieses Netzwerks. Der Scan zeigt auch bereits hinzugefügte Steckdosen, markiert sie als Hinzugefügt und prüft den gesamten Bereich bis zum Ende oder bis Stop gedrückt wird.', 'Keine Shelly-Steckdose in diesem Bereich gefunden.'),
    'es.ts': ('Añadir manualmente', 'Añadido', 'AP: conéctate directamente al Wi-Fi de Shelly — la dirección suele ser 192.168.33.1. STA: Shelly está en tu Wi-Fi — usa el rango de esa red. El escaneo también muestra los enchufes ya añadidos, los marca como Añadido y revisa todo el rango hasta terminar o pulsar Stop.', 'No se encontró ningún enchufe Shelly en este rango.'),
    'fr.ts': ('Ajouter manuellement', 'Ajoutée', 'AP : connectez-vous directement au Wi-Fi Shelly — l’adresse est généralement 192.168.33.1. STA : Shelly est sur votre Wi-Fi — utilisez la plage de ce réseau. Le scan affiche aussi les prises déjà ajoutées, les marque comme Ajoutée et vérifie toute la plage jusqu’à la fin ou jusqu’à Stop.', 'Aucune prise Shelly trouvée dans cette plage.'),
    'it.ts': ('Aggiungi manualmente', 'Aggiunta', 'AP: connettiti direttamente al Wi-Fi Shelly — l’indirizzo è di solito 192.168.33.1. STA: Shelly è nella tua rete Wi-Fi — usa l’intervallo di quella rete. La scansione mostra anche le prese già aggiunte, le contrassegna come Aggiunta e controlla tutto l’intervallo fino alla fine o a Stop.', 'Nessuna presa Shelly trovata in questo intervallo.'),
    'ptBr.ts': ('Adicionar manualmente', 'Adicionada', 'AP: conecte-se diretamente ao Wi-Fi do Shelly — o endereço geralmente é 192.168.33.1. STA: o Shelly está na sua rede Wi-Fi — use a faixa dessa rede. A busca também mostra tomadas já adicionadas, marca como Adicionada e verifica toda a faixa até terminar ou você tocar em Stop.', 'Nenhuma tomada Shelly foi encontrada nessa faixa.')
}


def property_pattern(key):
    return re.compile(rf"(?ms)^      {re.escape(key)}:\s*(?:\n\s*)?'(?:\\.|[^'])*',")


def replace_property(text, key, value):
    match = property_pattern(key).search(text)
    if not match:
        raise SystemExit(f'locale property missing: {key}')
    safe = value.replace('\\', '\\\\').replace("'", "\\'")
    return text[:match.start()] + f"      {key}: '{safe}'," + text[match.end():]


def insert_after_property(text, after_key, new_key, value):
    if re.search(rf"(?m)^      {re.escape(new_key)}:", text):
        return text
    match = property_pattern(after_key).search(text)
    if not match:
        raise SystemExit(f'locale anchor missing: {after_key}')
    safe = value.replace('\\', '\\\\').replace("'", "\\'")
    return text[:match.end()] + f"\n      {new_key}: '{safe}'," + text[match.end():]


for filename, (manual_label, added_label, scanner_help, empty_label) in locale_values.items():
    path = Path('apps/mobile/src/app/locales') / filename
    text = path.read_text()
    text = insert_after_property(text, 'addTitle', 'addManual', manual_label)
    text = insert_after_property(text, 'added', 'alreadyAdded', added_label)
    text = replace_property(text, 'scannerBehavior', scanner_help)
    text = replace_property(text, 'scanResultEmpty', empty_label)
    path.write_text(text)

test = 'apps/mobile/src/__tests__/hardware-setup.test.tsx'
replace(
    test,
    "  it('continues Shelly network scan past already saved plugs', async () => {",
    "  it('shows already saved Shelly devices and continues scanning the full range', async () => {"
)
replace(
    test,
    "    expect(await within(dialog).findByText('http://192.168.0.21/')).toBeInTheDocument();\n",
    "    expect(await within(dialog).findByText('http://192.168.0.20/')).toBeInTheDocument();\n    expect(within(dialog).getByText('http://192.168.0.21/')).toBeInTheDocument();\n    expect(\n      within(dialog).getByRole('button', { name: 'Dodane: http://192.168.0.20/' })\n    ).toBeDisabled();\n    expect(\n      within(dialog).getByRole('button', { name: 'Wybierz: http://192.168.0.21/' })\n    ).toBeEnabled();\n",
    1
)
replace(
    test,
    "    expect(scannedHosts).toContain('192.168.0.21');\n    expect(scannedHosts).not.toContain('192.168.0.20');\n",
    "    expect(scannedHosts).toContain('192.168.0.20');\n    expect(scannedHosts).toContain('192.168.0.21');\n",
    1
)
replace(
    test,
    "    const dialog = addDialog;\n\n    const tooltipButton = within(dialog).getByRole('button', {\n",
    "    const dialog = addDialog;\n    const manualSummary = within(dialog).getByText('Dodaj ręcznie');\n    const scanSummary = within(dialog).getByText('Skanuj sieć');\n    expect(manualSummary.closest('details')).toHaveAttribute('open');\n    expect(scanSummary.closest('details')).not.toHaveAttribute('open');\n    fireEvent.click(scanSummary);\n    expect(manualSummary.closest('details')).not.toHaveAttribute('open');\n    expect(scanSummary.closest('details')).toHaveAttribute('open');\n\n    const tooltipButton = within(dialog).getByRole('button', {\n",
    1
)
replace(
    test,
    "      within(dialog).getByText(/Już dodane gniazdka są pomijane/i)\n",
    "      within(dialog).getByText(/oznacza je jako Dodane/i)\n",
    1
)
