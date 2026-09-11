import type { HardwareSetupFlow } from '../../flows/hardware-setup/useHardwareSetupFlow.js';
import { t } from '../../app/i18n.js';

export const mutationError = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string'
      ? error.message
      : t('common.operationFailed');

export const formatDiagnosticNumber = (
  value: number | null | undefined,
  suffix: string,
  fractionDigits = 1
): string =>
  value == null ? t('common.missing') : `${value.toFixed(fractionDigits)}${suffix}`;

export const canInstallScript = (
  flow: Pick<
    HardwareSetupFlow,
    | 'selectedShelly'
    | 'configState'
    | 'isThresholdValid'
    | 'isAdvancedSettingsValid'
    | 'isVpdAssistValid'
  >
): boolean =>
  flow.selectedShelly !== null &&
  flow.configState.ok &&
  flow.isThresholdValid &&
  flow.isAdvancedSettingsValid &&
  flow.isVpdAssistValid;

export const shellyAddressLabel = (
  flow: Pick<HardwareSetupFlow, 'shellyBaseUrl'>
): string => flow.shellyBaseUrl ?? t('hardware.flow.inputShellyIp');

export const runtimeAddressLabel = (
  flow: Pick<HardwareSetupFlow, 'selectedSensor'>
): string => flow.selectedSensor?.runtimeAddress ?? t('hardware.flow.selectThermometer');

export interface HardwarePageProps<TFlow> {
  flow: TFlow;
}
