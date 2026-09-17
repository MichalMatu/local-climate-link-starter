import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import {
  scanShellySetupUrls,
  type ShellySetupScanOutcome,
  type ShellySetupScanResult
} from './shellyRequests.js';
import { createIpv4RangeScanUrls } from './validation.js';

export const buildShellyScanUrls = (startInput: string, endInput: string): string[] =>
  createIpv4RangeScanUrls(startInput, endInput);

export const useShellySetupScanFlow = () => {
  const [shellyScanStartInput, setShellyScanStartInput] = useState('192.168.0.1');
  const [shellyScanEndInput, setShellyScanEndInput] = useState('192.168.0.254');
  const [shellyScanStopped, setShellyScanStopped] = useState(false);
  const [shellyScanResults, setShellyScanResults] = useState<ShellySetupScanResult[]>([]);
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
          stopAfterFirst: false,
          onResult: (result) => {
            setShellyScanResults((current) =>
              current.some((candidate) => candidate.baseUrl === result.baseUrl)
                ? current
                : [...current, result]
            );
          }
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
    setShellyScanResults([]);
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
    setShellyScanResults([]);
    shellyScanMutation.reset();
  };

  return {
    shellyScanStartInput,
    setShellyScanStartInput,
    shellyScanEndInput,
    setShellyScanEndInput,
    shellyScanStopped,
    shellyScanResults,
    shellyScanMutation,
    startShellyScan,
    stopShellyScan,
    resetShellyScan
  };
};
