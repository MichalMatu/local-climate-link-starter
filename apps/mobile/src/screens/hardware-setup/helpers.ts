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

export interface HardwarePageProps<TFlow> {
  flow: TFlow;
}
