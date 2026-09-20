import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import {
  readShellySetupScanResult,
  type ShellySetupScanResult
} from './shellyRequests.js';
import { createIpv4RangeScanUrls } from './validation.js';

export const SHELLY_SETUP_SCAN_CONCURRENCY = 8;

export type ShellySetupScanOutcome = {
  results: ShellySetupScanResult[];
  stopped: boolean;
};

export type ScanShellySetupUrlsOptions = {
  baseUrls: string[];
  concurrency?: number;
  signal?: AbortSignal;
  stopAfterFirst?: boolean;
  onResult?: (result: ShellySetupScanResult) => void;
};

const combineAbortSignals = (signals: AbortSignal[]): AbortSignal => {
  const controller = new AbortController();
  const abort = () => controller.abort();

  for (const signal of signals) {
    if (signal.aborted) {
      abort();
      break;
    }
    signal.addEventListener('abort', abort, { once: true });
  }

  return controller.signal;
};

export const scanShellySetupUrls = async ({
  baseUrls,
  concurrency = SHELLY_SETUP_SCAN_CONCURRENCY,
  signal,
  stopAfterFirst = true,
  onResult
}: ScanShellySetupUrlsOptions): Promise<ShellySetupScanOutcome> => {
  const workerCount = Math.min(Math.max(1, Math.trunc(concurrency)), baseUrls.length);
  const foundController = new AbortController();
  const requestSignal = signal
    ? combineAbortSignals([signal, foundController.signal])
    : foundController.signal;
  const found: Array<{ index: number; result: ShellySetupScanResult }> = [];
  let nextIndex = 0;

  const runWorker = async (): Promise<void> => {
    while (
      nextIndex < baseUrls.length &&
      !requestSignal.aborted &&
      (!stopAfterFirst || found.length === 0)
    ) {
      const index = nextIndex;
      nextIndex += 1;
      const baseUrl = baseUrls[index];
      if (!baseUrl) continue;

      try {
        const result = await readShellySetupScanResult(baseUrl, requestSignal);
        found.push({ index, result });
        onResult?.(result);
        if (stopAfterFirst) {
          foundController.abort();
          break;
        }
      } catch {
        if (requestSignal.aborted) break;
        // Expected during LAN discovery: most local IPs will not be Shelly devices.
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return {
    results: found
      .sort((left, right) => left.index - right.index)
      .map((entry) => entry.result),
    stopped: signal?.aborted ?? false
  };
};

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
