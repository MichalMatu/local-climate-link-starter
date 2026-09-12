import { useMutation } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { scanShellySetupUrls, type ShellySetupScanOutcome } from './shellyRequests.js';
import type { ShellyDraftDevice } from './setupDraftStore.js';
import { createIpv4RangeScanUrls, normalizeShellyUrl } from './validation.js';

export const buildUnsavedShellyScanUrls = (
  devices: ShellyDraftDevice[],
  startInput: string,
  endInput: string
): string[] => {
  const savedBaseUrls = new Set<string>();
  for (const device of devices) {
    try {
      savedBaseUrls.add(normalizeShellyUrl(device.baseUrl));
    } catch {
      savedBaseUrls.add(device.baseUrl);
    }
  }

  return createIpv4RangeScanUrls(startInput, endInput).filter(
    (baseUrl) => !savedBaseUrls.has(baseUrl)
  );
};

export const useShellySetupScanFlow = (shellyDevices: ShellyDraftDevice[]) => {
  const [shellyScanStartInput, setShellyScanStartInput] = useState('192.168.0.1');
  const [shellyScanEndInput, setShellyScanEndInput] = useState('192.168.0.99');
  const [shellyScanStopped, setShellyScanStopped] = useState(false);
  const shellyScanAbortControllerRef = useRef<AbortController | null>(null);

  const scanBaseUrls = useMemo(
    () =>
      buildUnsavedShellyScanUrls(shellyDevices, shellyScanStartInput, shellyScanEndInput),
    [shellyDevices, shellyScanEndInput, shellyScanStartInput]
  );

  const shellyScanMutation = useMutation({
    mutationFn: async (): Promise<ShellySetupScanOutcome> => {
      setShellyScanStopped(false);
      const controller = new AbortController();
      shellyScanAbortControllerRef.current = controller;
      try {
        return await scanShellySetupUrls({
          baseUrls: scanBaseUrls,
          signal: controller.signal
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
