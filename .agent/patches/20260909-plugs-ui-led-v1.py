from pathlib import Path
from textwrap import dedent

ROOT = Path.cwd()

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(dedent(content).lstrip("\n"), encoding="utf-8")

def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    source = target.read_text(encoding="utf-8")
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:80]!r}")
    target.write_text(source.replace(old, new, 1), encoding="utf-8")

def replace_next(path: str, old: str, new: str) -> None:
    target = ROOT / path
    source = target.read_text(encoding="utf-8")
    if old not in source:
        raise SystemExit(f"{path}: missing next match: {old[:80]!r}")
    target.write_text(source.replace(old, new, 1), encoding="utf-8")

write(
    "packages/shelly-client/src/plugsUi.ts",
    r"""
    import { z } from 'zod';
    import { RPC_METHODS, type Result, type ShellyRpcTransport } from './model.js';

    const percentSchema = z.number().min(0).max(100);
    const rgbSchema = z
      .tuple([percentSchema, percentSchema, percentSchema])
      .nullable();
    const ledColorSchema = z.object({
      rgb: rgbSchema,
      brightness: percentSchema
    });
    const switchColorsSchema = z.object({
      on: ledColorSchema,
      off: ledColorSchema
    });
    const ledColorsSchema = z.object({
      'switch:0': switchColorsSchema.optional(),
      power: z.object({ brightness: percentSchema }).optional()
    });
    const ledModeSchema = z.enum(['power', 'switch', 'off']);
    const ledsConfigSchema = z.object({
      mode: ledModeSchema,
      colors: ledColorsSchema.optional()
    });
    const ledsPatchSchema = z
      .object({
        mode: ledModeSchema.optional(),
        colors: ledColorsSchema.optional()
      })
      .refine((value) => Object.keys(value).length > 0, {
        message: 'PLUGS_UI LED patch requires at least one field.'
      });
    const plugsUiConfigSchema = z.object({
      leds: ledsConfigSchema
    });
    const listMethodsResponseSchema = z.object({
      methods: z.array(z.string())
    });
    const setConfigResponseSchema = z.object({
      restart_required: z.boolean()
    });

    export type ShellyPlugsUiLedMode = z.infer<typeof ledModeSchema>;
    export type ShellyPlugsUiLedColor = z.infer<typeof ledColorSchema>;
    export type ShellyPlugsUiLedsConfig = z.infer<typeof ledsConfigSchema>;
    export type ShellyPlugsUiLedsPatch = z.input<typeof ledsPatchSchema>;
    export type ShellyPlugsUiConfig = z.infer<typeof plugsUiConfigSchema>;
    export type ShellyPlugsUiSetResult = z.infer<typeof setConfigResponseSchema>;
    export type ShellyPlugsUiReadResult =
      | { supported: false }
      | { supported: true; config: ShellyPlugsUiConfig };

    const validationError = (message: string) => ({
      kind: 'validation-failed' as const,
      userMessageKey: 'errors.validationFailed',
      technicalMessage: message,
      retryable: false
    });

    export const createRelayStateLedPatch = (): ShellyPlugsUiLedsPatch => ({
      mode: 'switch',
      colors: {
        'switch:0': {
          on: { rgb: [0, 100, 0], brightness: 100 },
          off: { rgb: [100, 0, 0], brightness: 100 }
        }
      }
    });

    export const createLedOffPatch = (): ShellyPlugsUiLedsPatch => ({
      mode: 'off'
    });

    export class RpcShellyPlugsUiClient {
      constructor(private readonly transport: ShellyRpcTransport) {}

      async read(): Promise<Result<ShellyPlugsUiReadResult>> {
        const methodsResponse = await this.transport.call<unknown>({
          method: RPC_METHODS.ShellyListMethods
        });
        if (!methodsResponse.ok) {
          return methodsResponse;
        }

        const parsedMethods = listMethodsResponseSchema.safeParse(methodsResponse.value);
        if (!parsedMethods.success) {
          return {
            ok: false,
            error: validationError(parsedMethods.error.message)
          };
        }

        const canRead = parsedMethods.data.methods.includes(
          RPC_METHODS.PlugsUiGetConfig
        );
        const canWrite = parsedMethods.data.methods.includes(
          RPC_METHODS.PlugsUiSetConfig
        );
        if (!canRead || !canWrite) {
          return { ok: true, value: { supported: false } };
        }

        const configResponse = await this.transport.call<unknown>({
          method: RPC_METHODS.PlugsUiGetConfig
        });
        if (!configResponse.ok) {
          return configResponse;
        }

        const parsedConfig = plugsUiConfigSchema.safeParse(configResponse.value);
        return parsedConfig.success
          ? { ok: true, value: { supported: true, config: parsedConfig.data } }
          : {
              ok: false,
              error: validationError(parsedConfig.error.message)
            };
      }

      async setLeds(
        patch: ShellyPlugsUiLedsPatch
      ): Promise<Result<ShellyPlugsUiSetResult>> {
        const parsedPatch = ledsPatchSchema.safeParse(patch);
        if (!parsedPatch.success) {
          return {
            ok: false,
            error: validationError(parsedPatch.error.message)
          };
        }

        const response = await this.transport.call<unknown>({
          method: RPC_METHODS.PlugsUiSetConfig,
          params: {
            config: {
              leds: parsedPatch.data
            }
          }
        });
        if (!response.ok) {
          return response;
        }

        const parsedResponse = setConfigResponseSchema.safeParse(response.value);
        return parsedResponse.success
          ? { ok: true, value: parsedResponse.data }
          : {
              ok: false,
              error: validationError(parsedResponse.error.message)
            };
      }
    }
    """
)

write(
    "packages/shelly-client/src/__tests__/plugsUi.test.ts",
    r"""
    import { describe, expect, it } from 'vitest';
    import {
      createLedOffPatch,
      createRelayStateLedPatch,
      RpcShellyPlugsUiClient,
      type Result,
      type ShellyRpcRequest,
      type ShellyRpcTransport
    } from '../index.js';

    class RecordingTransport implements ShellyRpcTransport {
      readonly requests: ShellyRpcRequest[] = [];

      constructor(private readonly responses: Result<unknown>[]) {}

      async call<TResponse>(request: ShellyRpcRequest): Promise<Result<TResponse>> {
        this.requests.push(request);
        const response = this.responses.shift();
        if (!response) {
          throw new Error('Missing fake response.');
        }
        return response as Result<TResponse>;
      }
    }

    describe('RpcShellyPlugsUiClient', () => {
      it('detects support and validates the current LED config', async () => {
        const transport = new RecordingTransport([
          {
            ok: true,
            value: {
              methods: [
                'Shelly.GetStatus',
                'PLUGS_UI.GetConfig',
                'PLUGS_UI.SetConfig'
              ]
            }
          },
          {
            ok: true,
            value: {
              leds: {
                mode: 'switch',
                colors: {
                  'switch:0': {
                    on: { rgb: [0, 100, 0], brightness: 100 },
                    off: { rgb: [100, 0, 0], brightness: 100 }
                  },
                  power: { brightness: 80 }
                }
              },
              controls: { 'switch:0': { in_mode: 'momentary' } }
            }
          }
        ]);
        const client = new RpcShellyPlugsUiClient(transport);

        await expect(client.read()).resolves.toEqual({
          ok: true,
          value: {
            supported: true,
            config: {
              leds: {
                mode: 'switch',
                colors: {
                  'switch:0': {
                    on: { rgb: [0, 100, 0], brightness: 100 },
                    off: { rgb: [100, 0, 0], brightness: 100 }
                  },
                  power: { brightness: 80 }
                }
              }
            }
          }
        });
        expect(transport.requests).toEqual([
          { method: 'Shelly.ListMethods' },
          { method: 'PLUGS_UI.GetConfig' }
        ]);
      });

      it('returns a clean unsupported state without calling PLUGS_UI', async () => {
        const transport = new RecordingTransport([
          {
            ok: true,
            value: { methods: ['Shelly.GetStatus', 'Switch.Set'] }
          }
        ]);
        const client = new RpcShellyPlugsUiClient(transport);

        await expect(client.read()).resolves.toEqual({
          ok: true,
          value: { supported: false }
        });
        expect(transport.requests).toEqual([{ method: 'Shelly.ListMethods' }]);
      });

      it('writes only the LED subtree for relay-state and off presets', async () => {
        const transport = new RecordingTransport([
          { ok: true, value: { restart_required: false } },
          { ok: true, value: { restart_required: false } }
        ]);
        const client = new RpcShellyPlugsUiClient(transport);

        await expect(
          client.setLeds(createRelayStateLedPatch())
        ).resolves.toEqual({
          ok: true,
          value: { restart_required: false }
        });
        await expect(client.setLeds(createLedOffPatch())).resolves.toEqual({
          ok: true,
          value: { restart_required: false }
        });

        expect(transport.requests).toEqual([
          {
            method: 'PLUGS_UI.SetConfig',
            params: {
              config: {
                leds: {
                  mode: 'switch',
                  colors: {
                    'switch:0': {
                      on: { rgb: [0, 100, 0], brightness: 100 },
                      off: { rgb: [100, 0, 0], brightness: 100 }
                    }
                  }
                }
              }
            }
          },
          {
            method: 'PLUGS_UI.SetConfig',
            params: { config: { leds: { mode: 'off' } } }
          }
        ]);
        expect(JSON.stringify(transport.requests)).not.toContain('"controls"');
      });
    });
    """
)

replace_once(
    "packages/shelly-client/src/model.ts",
    "  ShellyGetStatus: 'Shelly.GetStatus',\n",
    "  ShellyGetStatus: 'Shelly.GetStatus',\n  ShellyListMethods: 'Shelly.ListMethods',\n"
)
replace_once(
    "packages/shelly-client/src/model.ts",
    "  ScheduleDelete: 'Schedule.Delete'\n",
    "  ScheduleDelete: 'Schedule.Delete',\n  PlugsUiGetConfig: 'PLUGS_UI.GetConfig',\n  PlugsUiSetConfig: 'PLUGS_UI.SetConfig'\n"
)
replace_once(
    "packages/shelly-client/src/index.ts",
    "export * from './schedules.js';\n",
    "export * from './schedules.js';\nexport * from './plugsUi.js';\n"
)

write(
    "apps/mobile/src/flows/installations/deviceLed.ts",
    r"""
    import {
      createLedOffPatch,
      createRelayStateLedPatch,
      FetchShellyRpcTransport,
      RpcShellyPlugsUiClient,
      type Result,
      type ShellyPlugsUiReadResult
    } from '@lcl/shelly-client';
    import type { InstalledAutomation } from './model.js';

    export type InstalledShellyLedPreset = 'relay-state' | 'off';

    export const installedShellyLedSettingsQueryKey = (
      installation: InstalledAutomation
    ) =>
      [
        'installed-shelly-led-settings',
        installation.shelly.deviceId,
        installation.shelly.baseUrl
      ] as const;

    const createClient = (installation: InstalledAutomation) =>
      new RpcShellyPlugsUiClient(
        new FetchShellyRpcTransport({
          baseUrl: installation.shelly.baseUrl,
          defaultTimeoutMs: 5000
        })
      );

    const unwrap = <T>(result: Result<T>): T => {
      if (result.ok) {
        return result.value;
      }
      throw new Error(
        result.error.technicalMessage ??
          result.error.userMessageKey ??
          'Shelly PLUGS_UI request failed.'
      );
    };

    export const readInstalledShellyLedSettings = async (
      installation: InstalledAutomation
    ): Promise<ShellyPlugsUiReadResult> =>
      unwrap(await createClient(installation).read());

    export const applyInstalledShellyLedPreset = async (
      installation: InstalledAutomation,
      preset: InstalledShellyLedPreset
    ): Promise<ShellyPlugsUiReadResult> => {
      const client = createClient(installation);
      unwrap(
        await client.setLeds(
          preset === 'relay-state'
            ? createRelayStateLedPatch()
            : createLedOffPatch()
        )
      );
      return unwrap(await client.read());
    };
    """
)

write(
    "apps/mobile/src/screens/ShellyLedSettingsCard.tsx",
    r"""
    import { type ToastTone } from '@lcl/ui';
    import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
    import { useTranslation } from '../app/i18n.js';
    import {
      applyInstalledShellyLedPreset,
      installedShellyLedSettingsQueryKey,
      readInstalledShellyLedSettings,
      type InstalledShellyLedPreset
    } from '../flows/installations/deviceLed.js';
    import type { InstalledAutomation } from '../flows/installations/model.js';

    type ShellyLedSettingsCardProps = {
      installation: InstalledAutomation;
      onFeedback(tone: ToastTone, title: string): void;
    };

    const formatLedColor = ({
      rgb,
      brightness
    }: {
      rgb: [number, number, number] | null;
      brightness: number;
    }) =>
      `${rgb ? `RGB ${rgb.join('/')}` : 'RGB —'} · ${Math.round(brightness)}%`;

    export const ShellyLedSettingsCard = ({
      installation,
      onFeedback
    }: ShellyLedSettingsCardProps) => {
      const { t } = useTranslation();
      const queryClient = useQueryClient();
      const queryKey = installedShellyLedSettingsQueryKey(installation);
      const settingsQuery = useQuery({
        queryKey,
        queryFn: () => readInstalledShellyLedSettings(installation),
        retry: false,
        refetchOnWindowFocus: false
      });
      const presetMutation = useMutation({
        mutationFn: (preset: InstalledShellyLedPreset) =>
          applyInstalledShellyLedPreset(installation, preset),
        onSuccess: (settings, preset) => {
          queryClient.setQueryData(queryKey, settings);
          onFeedback(
            'ok',
            t(preset === 'relay-state' ? 'led.relayPresetSuccess' : 'led.offSuccess')
          );
        },
        onError: () => onFeedback('warning', t('led.actionFailed'))
      });

      const settings = settingsQuery.data;
      const config = settings?.supported ? settings.config : undefined;
      const mode = config?.leds.mode;
      const switchColors = config?.leds.colors?.['switch:0'];
      const powerBrightness = config?.leds.colors?.power?.brightness;
      const modeLabel =
        mode === 'power'
          ? t('led.mode.power')
          : mode === 'switch'
            ? t('led.mode.switch')
            : mode === 'off'
              ? t('led.mode.off')
              : '—';

      return (
        <article className="automation-card installation-detail-device-led">
          <div className="installation-section-heading">
            <div>
              <p className="automation-card__eyebrow">{t('led.eyebrow')}</p>
              <h2>{t('led.title')}</h2>
            </div>
            <button
              className="secondary-action"
              type="button"
              disabled={settingsQuery.isFetching}
              onClick={() => void settingsQuery.refetch()}
            >
              {t('common.refresh')}
            </button>
          </div>

          <p className="time-schedule-note">{t('led.description')}</p>

          {settingsQuery.isPending ? (
            <p className="time-schedule-note">{t('led.loading')}</p>
          ) : settingsQuery.isError ? (
            <p className="installation-detail-note">{t('led.unavailable')}</p>
          ) : settings && !settings.supported ? (
            <p className="time-schedule-note">{t('led.unsupported')}</p>
          ) : config ? (
            <>
              <dl className="automation-summary installation-detail-summary">
                <div>
                  <dt>{t('led.currentMode')}</dt>
                  <dd>{modeLabel}</dd>
                </div>
                {mode === 'switch' && switchColors ? (
                  <>
                    <div>
                      <dt>{t('led.onState')}</dt>
                      <dd>{formatLedColor(switchColors.on)}</dd>
                    </div>
                    <div>
                      <dt>{t('led.offState')}</dt>
                      <dd>{formatLedColor(switchColors.off)}</dd>
                    </div>
                  </>
                ) : null}
                {mode === 'power' && powerBrightness !== undefined ? (
                  <div>
                    <dt>{t('led.powerBrightness')}</dt>
                    <dd>{Math.round(powerBrightness)}%</dd>
                  </div>
                ) : null}
              </dl>

              <p className="time-schedule-note">{t('led.relayPresetHint')}</p>

              <div className="installation-detail-actions">
                <button
                  className="secondary-action"
                  type="button"
                  disabled={presetMutation.isPending}
                  onClick={() => presetMutation.mutate('relay-state')}
                >
                  {t('led.relayPreset')}
                </button>
                <button
                  className="secondary-action"
                  type="button"
                  disabled={presetMutation.isPending || mode === 'off'}
                  onClick={() => presetMutation.mutate('off')}
                >
                  {t('led.turnOff')}
                </button>
              </div>
            </>
          ) : null}
        </article>
      );
    };
    """
)

replace_once(
    "apps/mobile/src/screens/InstallationDetailScreen.tsx",
    "import { TimeInstallationDetail } from './TimeInstallationDetail.js';\n",
    "import { ShellyLedSettingsCard } from './ShellyLedSettingsCard.js';\nimport { TimeInstallationDetail } from './TimeInstallationDetail.js';\n"
)
replace_once(
    "apps/mobile/src/screens/InstallationDetailScreen.tsx",
    "        </article>\n      </section>\n\n      <ToastViewport\n",
    "        </article>\n\n        <ShellyLedSettingsCard installation={installation} onFeedback={pushToast} />\n      </section>\n\n      <ToastViewport\n"
)

replace_once(
    "apps/mobile/src/screens/TimeInstallationDetail.tsx",
    "import { useTranslation } from '../app/i18n.js';\n",
    "import { useTranslation } from '../app/i18n.js';\nimport { ShellyLedSettingsCard } from './ShellyLedSettingsCard.js';\n"
)
replace_once(
    "apps/mobile/src/screens/TimeInstallationDetail.tsx",
    "        </article>\n      </section>\n\n      <Modal\n",
    "        </article>\n\n        <ShellyLedSettingsCard installation={installation} onFeedback={pushToast} />\n      </section>\n\n      <Modal\n"
)

locale_blocks = {
    "pl.ts": r"""
      led: {
        eyebrow: 'Ustawienia urządzenia',
        title: 'LED gniazdka',
        description: 'To ustawienie należy do Shelly i nie zmienia logiki automatyki.',
        currentMode: 'Tryb LED',
        mode: {
          power: 'Zużycie energii',
          switch: 'Stan przekaźnika',
          off: 'Wyłączona'
        },
        onState: 'ON',
        offState: 'OFF',
        powerBrightness: 'Jasność trybu mocy',
        relayPreset: 'Sygnalizuj ON/OFF',
        relayPresetHint: 'Preset: ON zielony, OFF czerwony, jasność 100%.',
        turnOff: 'Wyłącz LED',
        loading: 'Odczytuję ustawienia LED…',
        unsupported:
          'To urządzenie lub firmware nie udostępnia ustawień PLUGS_UI. Pozostałe funkcje działają normalnie.',
        unavailable: 'Nie udało się odczytać ustawień LED z Shelly.',
        relayPresetSuccess: 'LED pokazuje teraz stan przekaźnika.',
        offSuccess: 'LED został wyłączony.',
        actionFailed: 'Nie udało się zmienić ustawień LED.'
      },
    """,
    "en.ts": r"""
      led: {
        eyebrow: 'Device settings',
        title: 'Plug LED',
        description: 'This setting belongs to Shelly and does not change automation logic.',
        currentMode: 'LED mode',
        mode: {
          power: 'Power usage',
          switch: 'Relay state',
          off: 'Off'
        },
        onState: 'ON',
        offState: 'OFF',
        powerBrightness: 'Power mode brightness',
        relayPreset: 'Show ON/OFF',
        relayPresetHint: 'Preset: ON green, OFF red, 100% brightness.',
        turnOff: 'Turn LED off',
        loading: 'Reading LED settings…',
        unsupported:
          'This device or firmware does not expose PLUGS_UI settings. Other features continue to work normally.',
        unavailable: 'Could not read LED settings from Shelly.',
        relayPresetSuccess: 'The LED now shows the relay state.',
        offSuccess: 'The LED has been turned off.',
        actionFailed: 'Could not change LED settings.'
      },
    """,
    "de.ts": r"""
      led: {
        eyebrow: 'Geräteeinstellungen',
        title: 'Steckdosen-LED',
        description: 'Diese Einstellung gehört zu Shelly und ändert die Automatisierungslogik nicht.',
        currentMode: 'LED-Modus',
        mode: {
          power: 'Leistungsverbrauch',
          switch: 'Relaiszustand',
          off: 'Aus'
        },
        onState: 'ON',
        offState: 'OFF',
        powerBrightness: 'Helligkeit im Leistungsmodus',
        relayPreset: 'ON/OFF anzeigen',
        relayPresetHint: 'Voreinstellung: ON grün, OFF rot, 100 % Helligkeit.',
        turnOff: 'LED ausschalten',
        loading: 'LED-Einstellungen werden gelesen…',
        unsupported:
          'Dieses Gerät oder diese Firmware stellt keine PLUGS_UI-Einstellungen bereit. Andere Funktionen arbeiten normal weiter.',
        unavailable: 'LED-Einstellungen konnten nicht von Shelly gelesen werden.',
        relayPresetSuccess: 'Die LED zeigt jetzt den Relaiszustand.',
        offSuccess: 'Die LED wurde ausgeschaltet.',
        actionFailed: 'LED-Einstellungen konnten nicht geändert werden.'
      },
    """,
    "es.ts": r"""
      led: {
        eyebrow: 'Ajustes del dispositivo',
        title: 'LED del enchufe',
        description: 'Este ajuste pertenece a Shelly y no cambia la lógica de automatización.',
        currentMode: 'Modo LED',
        mode: {
          power: 'Consumo de energía',
          switch: 'Estado del relé',
          off: 'Apagado'
        },
        onState: 'ON',
        offState: 'OFF',
        powerBrightness: 'Brillo del modo de potencia',
        relayPreset: 'Mostrar ON/OFF',
        relayPresetHint: 'Preajuste: ON verde, OFF rojo, brillo al 100 %.',
        turnOff: 'Apagar LED',
        loading: 'Leyendo ajustes del LED…',
        unsupported:
          'Este dispositivo o firmware no expone ajustes PLUGS_UI. Las demás funciones siguen funcionando con normalidad.',
        unavailable: 'No se pudieron leer los ajustes del LED de Shelly.',
        relayPresetSuccess: 'El LED ahora muestra el estado del relé.',
        offSuccess: 'El LED se ha apagado.',
        actionFailed: 'No se pudieron cambiar los ajustes del LED.'
      },
    """,
    "fr.ts": r"""
      led: {
        eyebrow: 'Réglages de l’appareil',
        title: 'LED de la prise',
        description: 'Ce réglage appartient à Shelly et ne modifie pas la logique d’automatisation.',
        currentMode: 'Mode LED',
        mode: {
          power: 'Consommation électrique',
          switch: 'État du relais',
          off: 'Éteinte'
        },
        onState: 'ON',
        offState: 'OFF',
        powerBrightness: 'Luminosité du mode puissance',
        relayPreset: 'Afficher ON/OFF',
        relayPresetHint: 'Préréglage : ON vert, OFF rouge, luminosité 100 %.',
        turnOff: 'Éteindre la LED',
        loading: 'Lecture des réglages LED…',
        unsupported:
          'Cet appareil ou ce firmware n’expose pas les réglages PLUGS_UI. Les autres fonctions continuent de fonctionner normalement.',
        unavailable: 'Impossible de lire les réglages LED depuis Shelly.',
        relayPresetSuccess: 'La LED affiche maintenant l’état du relais.',
        offSuccess: 'La LED a été éteinte.',
        actionFailed: 'Impossible de modifier les réglages LED.'
      },
    """,
    "it.ts": r"""
      led: {
        eyebrow: 'Impostazioni dispositivo',
        title: 'LED della presa',
        description: 'Questa impostazione appartiene a Shelly e non modifica la logica dell’automazione.',
        currentMode: 'Modalità LED',
        mode: {
          power: 'Consumo energetico',
          switch: 'Stato relè',
          off: 'Spento'
        },
        onState: 'ON',
        offState: 'OFF',
        powerBrightness: 'Luminosità modalità potenza',
        relayPreset: 'Mostra ON/OFF',
        relayPresetHint: 'Preset: ON verde, OFF rosso, luminosità 100%.',
        turnOff: 'Spegni LED',
        loading: 'Lettura impostazioni LED…',
        unsupported:
          'Questo dispositivo o firmware non espone le impostazioni PLUGS_UI. Le altre funzioni continuano a funzionare normalmente.',
        unavailable: 'Impossibile leggere le impostazioni LED da Shelly.',
        relayPresetSuccess: 'Il LED ora mostra lo stato del relè.',
        offSuccess: 'Il LED è stato spento.',
        actionFailed: 'Impossibile modificare le impostazioni LED.'
      },
    """,
    "ptBr.ts": r"""
      led: {
        eyebrow: 'Configurações do dispositivo',
        title: 'LED da tomada',
        description: 'Esta configuração pertence ao Shelly e não altera a lógica da automação.',
        currentMode: 'Modo do LED',
        mode: {
          power: 'Consumo de energia',
          switch: 'Estado do relé',
          off: 'Desligado'
        },
        onState: 'ON',
        offState: 'OFF',
        powerBrightness: 'Brilho do modo de potência',
        relayPreset: 'Mostrar ON/OFF',
        relayPresetHint: 'Predefinição: ON verde, OFF vermelho, brilho de 100%.',
        turnOff: 'Desligar LED',
        loading: 'Lendo configurações do LED…',
        unsupported:
          'Este dispositivo ou firmware não expõe configurações PLUGS_UI. Os demais recursos continuam funcionando normalmente.',
        unavailable: 'Não foi possível ler as configurações do LED do Shelly.',
        relayPresetSuccess: 'O LED agora mostra o estado do relé.',
        offSuccess: 'O LED foi desligado.',
        actionFailed: 'Não foi possível alterar as configurações do LED.'
      },
    """
}

for filename, block in locale_blocks.items():
    path = f"apps/mobile/src/app/locales/{filename}"
    marker = "  common: {\n"
    source = read(path)
    if marker not in source:
        raise SystemExit(f"{path}: common marker missing")
    if "  led: {\n" in source:
        raise SystemExit(f"{path}: led block already exists")
    (ROOT / path).write_text(
        source.replace(marker, dedent(block).lstrip("\n") + marker, 1),
        encoding="utf-8"
    )

write(
    "apps/mobile/src/__tests__/shelly-led-settings.test.tsx",
    r"""
    import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
    import { cleanup, fireEvent, render, screen } from '@testing-library/react';
    import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
    import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
    import { I18nProvider, setLocalePreference } from '../app/i18n.js';
    import { createInstalledAutomation } from '../flows/installations/model.js';
    import { ShellyLedSettingsCard } from '../screens/ShellyLedSettingsCard.js';

    const jsonResponse = (payload: unknown) =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });

    const installation = () => {
      const config = createDefaultShellyThermostatConfig(
        'xiaomi_lywsd03mmc_bthome_v2',
        'heating'
      );
      return createInstalledAutomation({
        shelly: { id: 'shellyplugsg3-led-test', model: 'S3PL-00112EU', gen: 3 },
        shellyName: 'Salon',
        baseUrl: 'http://192.168.0.20/',
        scriptId: 1,
        scriptHash: 'lcl-led-test',
        config,
        nowMs: 1000
      });
    };

    const renderCard = (onFeedback = vi.fn()) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false }
        }
      });
      return {
        onFeedback,
        ...render(
          <I18nProvider>
            <QueryClientProvider client={queryClient}>
              <ShellyLedSettingsCard
                installation={installation()}
                onFeedback={onFeedback}
              />
            </QueryClientProvider>
          </I18nProvider>
        )
      };
    };

    describe('ShellyLedSettingsCard', () => {
      beforeEach(() => {
        setLocalePreference('pl');
        vi.restoreAllMocks();
      });

      afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
      });

      it('reads and applies native PLUGS_UI LED presets without touching controls', async () => {
        let mode: 'power' | 'switch' | 'off' = 'power';
        const requests: Array<{
          method?: string;
          params?: Record<string, unknown>;
        }> = [];

        vi.stubGlobal(
          'fetch',
          vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            const body = JSON.parse(String(init?.body ?? '{}')) as {
              id?: number | string;
              method?: string;
              params?: {
                config?: {
                  leds?: {
                    mode?: 'power' | 'switch' | 'off';
                  };
                };
              };
            };
            requests.push({
              method: body.method,
              params: body.params as unknown as Record<string, unknown> | undefined
            });

            let result: unknown = {};
            switch (body.method) {
              case 'Shelly.ListMethods':
                result = {
                  methods: [
                    'Shelly.GetStatus',
                    'PLUGS_UI.GetConfig',
                    'PLUGS_UI.SetConfig'
                  ]
                };
                break;
              case 'PLUGS_UI.GetConfig':
                result = {
                  leds: {
                    mode,
                    colors: {
                      'switch:0': {
                        on: { rgb: [0, 100, 0], brightness: 100 },
                        off: { rgb: [100, 0, 0], brightness: 100 }
                      },
                      power: { brightness: 80 }
                    }
                  },
                  controls: { 'switch:0': { in_mode: 'momentary' } }
                };
                break;
              case 'PLUGS_UI.SetConfig':
                mode = body.params?.config?.leds?.mode ?? mode;
                result = { restart_required: false };
                break;
              default:
                result = {};
            }

            return jsonResponse({ id: body.id ?? 1, result });
          })
        );

        const { onFeedback } = renderCard();

        expect(
          await screen.findByRole('heading', { name: 'LED gniazdka' })
        ).toBeVisible();
        expect(screen.getByText('Zużycie energii')).toBeVisible();
        expect(screen.getByText('80%')).toBeVisible();

        fireEvent.click(
          screen.getByRole('button', { name: 'Sygnalizuj ON/OFF' })
        );

        expect(await screen.findByText('Stan przekaźnika')).toBeVisible();
        expect(screen.getByText('RGB 0/100/0 · 100%')).toBeVisible();
        expect(screen.getByText('RGB 100/0/0 · 100%')).toBeVisible();
        expect(onFeedback).toHaveBeenCalledWith(
          'ok',
          'LED pokazuje teraz stan przekaźnika.'
        );

        const relaySet = requests.find(
          (request) =>
            request.method === 'PLUGS_UI.SetConfig' &&
            JSON.stringify(request.params).includes('"switch"')
        );
        expect(relaySet?.params).toEqual({
          config: {
            leds: {
              mode: 'switch',
              colors: {
                'switch:0': {
                  on: { rgb: [0, 100, 0], brightness: 100 },
                  off: { rgb: [100, 0, 0], brightness: 100 }
                }
              }
            }
          }
        });
        expect(JSON.stringify(relaySet)).not.toContain('"controls"');

        fireEvent.click(screen.getByRole('button', { name: 'Wyłącz LED' }));

        expect(await screen.findByText('Wyłączona')).toBeVisible();
        expect(onFeedback).toHaveBeenCalledWith('ok', 'LED został wyłączony.');
        expect(
          requests.some(
            (request) =>
              request.method === 'PLUGS_UI.SetConfig' &&
              JSON.stringify(request.params) ===
                JSON.stringify({ config: { leds: { mode: 'off' } } })
          )
        ).toBe(true);
      });

      it('shows unsupported firmware/device as a stable non-error state', async () => {
        const methods: string[] = [];

        vi.stubGlobal(
          'fetch',
          vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            const body = JSON.parse(String(init?.body ?? '{}')) as {
              id?: number | string;
              method?: string;
            };
            if (body.method) {
              methods.push(body.method);
            }
            return jsonResponse({
              id: body.id ?? 1,
              result:
                body.method === 'Shelly.ListMethods'
                  ? { methods: ['Shelly.GetStatus', 'Switch.Set'] }
                  : {}
            });
          })
        );

        renderCard();

        expect(
          await screen.findByText(
            'To urządzenie lub firmware nie udostępnia ustawień PLUGS_UI. Pozostałe funkcje działają normalnie.'
          )
        ).toBeVisible();
        expect(
          screen.queryByRole('button', { name: 'Sygnalizuj ON/OFF' })
        ).toBeNull();
        expect(methods).toEqual(['Shelly.ListMethods']);
      });
    });
    """
)

e2e_path = "apps/mobile/e2e/responsive.spec.ts"
replace_once(
    e2e_path,
    """const viewports = [
  { name: 'phone-small', width: 360, height: 740 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 }
] as const;
""",
    """const viewports = [
  { name: 'phone-small', width: 360, height: 800 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'phone-large', width: 412, height: 915 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 }
] as const;
"""
)

replace_once(
    e2e_path,
    "  let scriptRunning = true;\n  let relayOn = true;\n",
    "  let scriptRunning = true;\n  let relayOn = true;\n  let ledMode: 'power' | 'switch' | 'off' = 'power';\n"
)
replace_once(
    e2e_path,
    "      params?: { id?: number; on?: boolean };\n",
    """      params?: {
        id?: number;
        on?: boolean;
        config?: { leds?: { mode?: 'power' | 'switch' | 'off' } };
      };
"""
)
replace_once(
    e2e_path,
    """      case 'Script.List':
        result = {
          scripts: [
            {
              id: 1,
              name: 'Local Climate Link Thermostat',
              enable: true,
              running: scriptRunning
            }
          ]
        };
        break;
""",
    """      case 'Shelly.ListMethods':
        result = {
          methods: [
            'Shelly.GetStatus',
            'PLUGS_UI.GetConfig',
            'PLUGS_UI.SetConfig'
          ]
        };
        break;
      case 'PLUGS_UI.GetConfig':
        result = {
          leds: {
            mode: ledMode,
            colors: {
              'switch:0': {
                on: { rgb: [0, 100, 0], brightness: 100 },
                off: { rgb: [100, 0, 0], brightness: 100 }
              },
              power: { brightness: 80 }
            }
          },
          controls: { 'switch:0': { in_mode: 'momentary' } }
        };
        break;
      case 'PLUGS_UI.SetConfig':
        ledMode = requestBody.params?.config?.leds?.mode ?? ledMode;
        result = { restart_required: false };
        break;
      case 'Script.List':
        result = {
          scripts: [
            {
              id: 1,
              name: 'Local Climate Link Thermostat',
              enable: true,
              running: scriptRunning
            }
          ]
        };
        break;
"""
)

replace_once(
    e2e_path,
    "  let relayOn = false;\n  let rev = 0;\n",
    "  let relayOn = false;\n  let ledMode: 'power' | 'switch' | 'off' = 'power';\n  let rev = 0;\n"
)
replace_once(
    e2e_path,
    "        calls?: Array<{ method: string; params?: Record<string, unknown> }>;\n",
    """        calls?: Array<{ method: string; params?: Record<string, unknown> }>;
        config?: { leds?: { mode?: 'power' | 'switch' | 'off' } };
"""
)
replace_once(
    e2e_path,
    """      case 'Script.List':
        result = { scripts: [] };
        break;
      case 'Schedule.List':
""",
    """      case 'Shelly.ListMethods':
        result = {
          methods: [
            'Shelly.GetStatus',
            'PLUGS_UI.GetConfig',
            'PLUGS_UI.SetConfig'
          ]
        };
        break;
      case 'PLUGS_UI.GetConfig':
        result = {
          leds: {
            mode: ledMode,
            colors: {
              'switch:0': {
                on: { rgb: [0, 100, 0], brightness: 100 },
                off: { rgb: [100, 0, 0], brightness: 100 }
              },
              power: { brightness: 80 }
            }
          },
          controls: { 'switch:0': { in_mode: 'momentary' } }
        };
        break;
      case 'PLUGS_UI.SetConfig':
        ledMode = requestBody.params?.config?.leds?.mode ?? ledMode;
        result = { restart_required: false };
        break;
      case 'Script.List':
        result = { scripts: [] };
        break;
      case 'Schedule.List':
"""
)

replace_once(
    e2e_path,
    "    await expect(page.getByRole('heading', { name: 'Klimat teraz' })).toBeVisible();\n",
    """    await expect(page.getByRole('heading', { name: 'Klimat teraz' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'LED gniazdka' })).toBeVisible();
"""
)
replace_once(
    e2e_path,
    "    await expect(page.getByRole('heading', { name: 'Harmonogram' })).toBeVisible();\n    await expect(page.getByText('Natywny Shelly Schedule')).toBeVisible();\n",
    """    await expect(page.getByRole('heading', { name: 'Harmonogram' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'LED gniazdka' })).toBeVisible();
    await expect(page.getByText('Natywny Shelly Schedule')).toBeVisible();
"""
)

insert_marker = "test('installed automation detail safely pauses and resumes on phone', async ({\n"
source = read(e2e_path)
if source.count(insert_marker) != 1:
    raise SystemExit("responsive.spec.ts: detail test marker mismatch")
new_test = r"""
test('installed automation detail configures native Shelly LED presets', async ({
  page
}) => {
  const consoleProblems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => consoleProblems.push(error.message));

  await page.setViewportSize({ width: 390, height: 844 });
  await seedInstalledAutomation(page);
  await mockShellyRpc(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Szczegóły' }).click();
  const ledCard = page
    .getByRole('heading', { name: 'LED gniazdka' })
    .locator('xpath=ancestor::article[1]');
  await expect(ledCard).toBeVisible();
  await expect(ledCard.getByText('Zużycie energii')).toBeVisible();

  await ledCard.getByRole('button', { name: 'Sygnalizuj ON/OFF' }).click();
  await expect(ledCard.getByText('Stan przekaźnika')).toBeVisible();
  await expect(ledCard.getByText('RGB 0/100/0 · 100%')).toBeVisible();
  await expect(ledCard.getByText('RGB 100/0/0 · 100%')).toBeVisible();
  await expect(page.getByText('LED pokazuje teraz stan przekaźnika.')).toBeVisible();

  await ledCard.getByRole('button', { name: 'Wyłącz LED' }).click();
  await expect(ledCard.getByText('Wyłączona')).toBeVisible();
  await expect(page.getByText('LED został wyłączony.')).toBeVisible();

  await expectNoHorizontalOverflow(page);
  await expectNoLegacyInlineFeedback(page);
  expect(consoleProblems).toEqual([]);
});

"""
(ROOT / e2e_path).write_text(
    source.replace(insert_marker, dedent(new_test).lstrip("\n") + insert_marker, 1),
    encoding="utf-8"
)

replace_once(
    e2e_path,
    """    await expectNoHorizontalOverflow(page);
    await expectNoLegacyInlineFeedback(page);
    expect(consoleProblems).toEqual([]);
  });
}

test('installed automation detail configures native Shelly LED presets'""",
    """    await expectNoHorizontalOverflow(page);
    await expectNoLegacyInlineFeedback(page);
    await page.screenshot({
      path: `test-results/visual-audit/installation-led-${viewport.name}.png`,
      fullPage: true
    });
    expect(consoleProblems).toEqual([]);
  });
}

test('installed automation detail configures native Shelly LED presets'"""
)

replace_once(
    ".github/workflows/ci.yml",
    "      - name: Responsive smoke\n        run: pnpm e2e:responsive\n",
    """      - name: Responsive smoke
        run: pnpm e2e:responsive

      - name: Upload responsive visual audit
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: responsive-visual-audit
          path: test-results/visual-audit
          if-no-files-found: ignore
"""
)

print("PLUGS_UI LED slice source edits applied.")
