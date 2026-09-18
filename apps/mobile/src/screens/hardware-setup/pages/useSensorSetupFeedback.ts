import type { ToastTone } from '@lcl/ui';
import { useEffect, useRef } from 'react';
import type { Translate } from '../../../app/i18n.js';
import { mutationError } from '../helpers.js';
import type { SensorSetupFlow } from '../pageContracts.js';
import { useSavedSensorLiveScanLifecycle } from '../../../flows/hardware-setup/useSavedSensorLiveScanLifecycle.js';

type PushToast = (tone: ToastTone, title: string, detail?: string) => void;

type SensorSetupFeedbackOptions = {
  flow: SensorSetupFlow;
  shouldRunSavedSensorLiveScan: boolean;
  pushToast: PushToast;
  t: Translate;
};

export const useSensorSetupFeedback = ({
  flow,
  shouldRunSavedSensorLiveScan,
  pushToast,
  t
}: SensorSetupFeedbackOptions) => {
  const shownPhoneBleErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!flow.phoneBleScanMutation.isError) {
      return;
    }

    const message = mutationError(flow.phoneBleScanMutation.error);
    if (shownPhoneBleErrorRef.current === message) {
      return;
    }

    shownPhoneBleErrorRef.current = message;
    pushToast('warning', t('hardware.sensor.phoneBleFailedTitle'), message);
    flow.phoneBleScanMutation.reset();
  }, [flow.phoneBleScanMutation, pushToast, t]);

  useSavedSensorLiveScanLifecycle({ flow, enabled: shouldRunSavedSensorLiveScan });

  useEffect(() => {
    if (!flow.setPvvxTimeMutation.isSuccess) {
      return;
    }

    pushToast(
      'ok',
      flow.setPvvxTimeMutation.data?.acknowledged
        ? t('hardware.sensor.pvvxTimeSetTitle')
        : t('hardware.sensor.pvvxTimeSentTitle')
    );
    flow.setPvvxTimeMutation.reset();
  }, [flow.setPvvxTimeMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.setPvvxTimeMutation.isError) {
      return;
    }

    pushToast(
      'warning',
      t('hardware.sensor.pvvxFailedTitle'),
      mutationError(flow.setPvvxTimeMutation.error)
    );
    flow.setPvvxTimeMutation.reset();
  }, [flow.setPvvxTimeMutation, pushToast, t]);

  const resetPhoneBleError = () => {
    shownPhoneBleErrorRef.current = null;
  };

  return { resetPhoneBleError };
};
