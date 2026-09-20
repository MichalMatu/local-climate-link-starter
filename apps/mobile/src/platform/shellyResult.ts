import type { Result, ShellyClientError } from '@lcl/shelly-client';
import { t } from '../app/i18n.js';

export const shellyInvalidResponseMessage = (): string =>
  t('hardware.shelly.invalidResponse');
const shellyScriptsMissingMessage = (): string => t('hardware.shelly.scriptsMissing');
const shellyScriptsDisabledMessage = (): string => t('hardware.shelly.scriptsDisabled');
const shellyBleMissingMessage = (): string => t('hardware.shelly.bleMissing');
const shellyBleDisabledMessage = (): string => t('hardware.shelly.bleDisabled');

export const shellyResultErrorMessage = (
  result: Result<unknown, ShellyClientError>
): string =>
  result.ok
    ? 'OK'
    : result.error.kind === 'matter-enabled'
      ? t('hardware.safety.matterBlocked')
      : result.error.userMessageKey === 'errors.shellyInvalidResponse' ||
          result.error.technicalMessage?.startsWith('Shelly RPC HTTP ')
        ? shellyInvalidResponseMessage()
        : result.error.technicalMessage?.includes('Scripts component') ||
            result.error.technicalMessage?.includes('Script.List')
          ? shellyScriptsMissingMessage()
          : result.error.technicalMessage?.includes('Scripts are disabled')
            ? shellyScriptsDisabledMessage()
            : result.error.technicalMessage?.includes('BLE component')
              ? shellyBleMissingMessage()
              : result.error.technicalMessage?.includes('BLE is disabled')
                ? shellyBleDisabledMessage()
                : (result.error.technicalMessage ?? `Shelly RPC: ${result.error.kind}`);

export const unwrapShellyResult = <T>(result: Result<T, ShellyClientError>): T => {
  if (!result.ok) {
    throw new Error(shellyResultErrorMessage(result));
  }
  return result.value;
};
