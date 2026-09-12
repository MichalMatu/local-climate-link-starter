import type { ToastTone } from '@lcl/ui';
import { useEffect, useRef } from 'react';
import type { Translate } from '../../../app/i18n.js';
import { mutationError } from '../helpers.js';
import type { ShellySetupFlow } from '../pageContracts.js';

type PushToast = (tone: ToastTone, title: string, detail?: string) => void;

type ShellySetupFeedbackOptions = {
  flow: ShellySetupFlow;
  isBleScanModalOpen: boolean;
  pushToast: PushToast;
  t: Translate;
};

export const useShellySetupFeedback = ({
  flow,
  isBleScanModalOpen,
  pushToast,
  t
}: ShellySetupFeedbackOptions) => {
  const shownBleStopErrorRef = useRef<string | null>(null);
  const shownControlFeedbackRef = useRef<Record<string, string>>({});
  const autoRefreshShellyIdsRef = useRef<Set<string>>(new Set());
  const pollBleDiscoveryRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const savedIds = new Set(flow.shellyDevices.map((device) => device.id));
    autoRefreshShellyIdsRef.current.forEach((deviceId) => {
      if (!savedIds.has(deviceId)) {
        autoRefreshShellyIdsRef.current.delete(deviceId);
      }
    });

    flow.shellyDevices.forEach((device) => {
      const controlState = flow.shellyControlStates[device.id];
      if (
        controlState?.status ||
        controlState?.pendingAction ||
        autoRefreshShellyIdsRef.current.has(device.id)
      ) {
        return;
      }

      autoRefreshShellyIdsRef.current.add(device.id);
      flow.refreshShellyControl(device);
    });
  }, [flow.refreshShellyControl, flow.shellyControlStates, flow.shellyDevices]);

  useEffect(() => {
    Object.entries(flow.shellyControlStates).forEach(([deviceId, controlState]) => {
      const message = controlState.error ?? controlState.message;
      if (!message || controlState.updatedAtMs === null) {
        return;
      }

      const feedbackKey = `${controlState.updatedAtMs}:${message}`;
      if (shownControlFeedbackRef.current[deviceId] === feedbackKey) {
        return;
      }

      shownControlFeedbackRef.current[deviceId] = feedbackKey;
      pushToast(controlState.error ? 'warning' : 'ok', message);
      flow.acknowledgeShellyControlFeedback(deviceId, controlState.updatedAtMs, message);
    });
  }, [flow.acknowledgeShellyControlFeedback, flow.shellyControlStates, pushToast]);

  useEffect(() => {
    if (!flow.stopBleDiscoveryMutation.isError) {
      return;
    }

    const message = mutationError(flow.stopBleDiscoveryMutation.error);
    if (shownBleStopErrorRef.current === message) {
      return;
    }

    shownBleStopErrorRef.current = message;
    pushToast('warning', t('hardware.shelly.bleScannerCloseFailedTitle'), message);
    flow.stopBleDiscoveryMutation.reset();
  }, [flow.stopBleDiscoveryMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.shellyScanMutation.isError) {
      return;
    }
    pushToast(
      'warning',
      t('hardware.shelly.scanNetworkFailedTitle'),
      mutationError(flow.shellyScanMutation.error)
    );
    flow.shellyScanMutation.reset();
  }, [flow.shellyScanMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.startBleDiscoveryMutation.isError) {
      return;
    }
    pushToast(
      'warning',
      t('hardware.shelly.bleScannerStartFailedTitle'),
      mutationError(flow.startBleDiscoveryMutation.error)
    );
    flow.startBleDiscoveryMutation.reset();
  }, [flow.startBleDiscoveryMutation, pushToast, t]);

  pollBleDiscoveryRef.current = () => {
    if (
      !flow.bleDiscoverySession ||
      flow.bleDiscoverySnapshot?.running === false ||
      flow.startBleDiscoveryMutation.isPending ||
      flow.refreshBleDiscoveryMutation.isPending ||
      flow.restartBleDiscoveryMutation.isPending ||
      flow.refreshBleDiscoveryMutation.isError ||
      flow.restartBleDiscoveryMutation.isError ||
      flow.stopBleDiscoveryMutation.isPending
    ) {
      return;
    }
    flow.refreshBleDiscovery();
  };

  useEffect(() => {
    if (!isBleScanModalOpen || !flow.bleDiscoverySession) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      pollBleDiscoveryRef.current();
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [flow.bleDiscoverySession, isBleScanModalOpen]);

  const resetBleStopError = () => {
    shownBleStopErrorRef.current = null;
  };

  return { resetBleStopError };
};
