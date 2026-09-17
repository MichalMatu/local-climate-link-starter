import { useMutation } from '@tanstack/react-query';
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
