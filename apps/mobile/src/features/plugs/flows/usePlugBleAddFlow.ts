import { Capacitor } from '@capacitor/core';
import { CapacitorBleScanner, type BleScanner } from '@lcl/ble-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  PlugBleAdvertisement,
  VerifiedPlugBleCandidate
} from '../data/plugBleOnboarding.js';
import { inspectPlugBleCandidate } from './inspectPlugBleCandidate.js';
import {
  DEFAULT_PLUG_BLE_SCAN_TIMEOUT_MS,
  scanPlugBleCandidates
} from './scanPlugBleCandidates.js';

export type UsePlugBleAddFlowDependencies = {
  createScanner?(): BleScanner;
  inspectCandidate?(candidate: PlugBleAdvertisement): Promise<VerifiedPlugBleCandidate>;
};

export type UsePlugBleAddFlowResult = {
  candidates: PlugBleAdvertisement[];
  scanning: boolean;
  error: string | null;
  inspectingDeviceId: string | null;
  verifiedCandidate: VerifiedPlugBleCandidate | null;
  startScan(): void;
  stopScan(): void;
  inspectCandidate(candidate: PlugBleAdvertisement): Promise<void>;
  clearVerifiedCandidate(): void;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Bluetooth scan failed.';

const mergeCandidate = (
  current: readonly PlugBleAdvertisement[],
  candidate: PlugBleAdvertisement
): PlugBleAdvertisement[] => {
  const key = candidate.deviceId.toLowerCase();
  const next = [
    ...current.filter((item) => item.deviceId.toLowerCase() !== key),
    candidate
  ];
  return next.sort((left, right) => (right.rssi ?? -999) - (left.rssi ?? -999));
};

export const usePlugBleAddFlow = (
  dependencies: UsePlugBleAddFlowDependencies = {}
): UsePlugBleAddFlowResult => {
  const [candidates, setCandidates] = useState<PlugBleAdvertisement[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspectingDeviceId, setInspectingDeviceId] = useState<string | null>(null);
  const [verifiedCandidate, setVerifiedCandidate] =
    useState<VerifiedPlugBleCandidate | null>(null);
  const scannerRef = useRef<BleScanner | null>(null);
  const scanGenerationRef = useRef(0);

  const createScanner = useCallback(
    () =>
      dependencies.createScanner?.() ??
      new CapacitorBleScanner({ platform: Capacitor.getPlatform() }),
    [dependencies]
  );
  const inspectCandidateImpl = dependencies.inspectCandidate ?? inspectPlugBleCandidate;

  const stopScanNow = useCallback(async (): Promise<void> => {
    scanGenerationRef.current += 1;
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (scanner) await scanner.stopScan().catch(() => undefined);
  }, []);

  const stopScan = useCallback(() => {
    void stopScanNow();
  }, [stopScanNow]);

  const startScan = useCallback(() => {
    const generation = scanGenerationRef.current + 1;
    scanGenerationRef.current = generation;
    const scanner = createScanner();
    scannerRef.current = scanner;
    setCandidates([]);
    setVerifiedCandidate(null);
    setError(null);
    setScanning(true);
    void scanPlugBleCandidates({
      scanner,
      timeoutMs: DEFAULT_PLUG_BLE_SCAN_TIMEOUT_MS,
      onCandidate: (candidate) => {
        if (scanGenerationRef.current !== generation) return;
        setCandidates((current) => mergeCandidate(current, candidate));
      }
    })
      .then((result) => {
        if (scanGenerationRef.current !== generation) return;
        setCandidates(result);
      })
      .catch((caught) => {
        if (scanGenerationRef.current !== generation) return;
        setError(errorMessage(caught));
      })
      .finally(() => {
        if (scanGenerationRef.current !== generation) return;
        scannerRef.current = null;
        setScanning(false);
      });
  }, [createScanner]);

  const inspectCandidate = useCallback(
    async (candidate: PlugBleAdvertisement): Promise<void> => {
      await stopScanNow();
      setError(null);
      setVerifiedCandidate(null);
      setInspectingDeviceId(candidate.deviceId);
      try {
        setVerifiedCandidate(await inspectCandidateImpl(candidate));
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setInspectingDeviceId(null);
      }
    },
    [inspectCandidateImpl, stopScanNow]
  );

  const clearVerifiedCandidate = useCallback(() => {
    setVerifiedCandidate(null);
  }, []);

  useEffect(
    () => () => {
      void stopScanNow();
    },
    [stopScanNow]
  );

  return {
    candidates,
    scanning,
    error,
    inspectingDeviceId,
    verifiedCandidate,
    startScan,
    stopScan,
    inspectCandidate,
    clearVerifiedCandidate
  };
};
