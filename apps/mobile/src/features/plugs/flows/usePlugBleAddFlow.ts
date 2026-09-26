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
  autoStart?: boolean;
  createScanner?(): BleScanner;
  inspectCandidate?(candidate: PlugBleAdvertisement): Promise<VerifiedPlugBleCandidate>;
};

export type UsePlugBleAddFlowResult = {
  candidates: PlugBleAdvertisement[];
  scanning: boolean;
  error: string | null;
  inspectingDeviceId: string | null;
  verifiedCandidates: VerifiedPlugBleCandidate[];
  startScan(): void;
  stopScan(): void;
  verifyCandidate(
    candidate: PlugBleAdvertisement
  ): Promise<VerifiedPlugBleCandidate | null>;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Bluetooth scan failed.';

const mergeCandidate = (
  current: readonly PlugBleAdvertisement[],
  candidate: PlugBleAdvertisement
): PlugBleAdvertisement[] => {
  const key = candidate.deviceId.toLowerCase();
  const index = current.findIndex((item) => item.deviceId.toLowerCase() === key);
  if (index < 0) return [...current, candidate];

  const next = [...current];
  next[index] = {
    ...current[index],
    ...candidate,
    rssi: candidate.rssi ?? current[index]?.rssi ?? null
  };
  return next;
};

const mergeVerifiedCandidate = (
  current: readonly VerifiedPlugBleCandidate[],
  candidate: VerifiedPlugBleCandidate
): VerifiedPlugBleCandidate[] => {
  const key = candidate.bleDeviceId.toLowerCase();
  const index = current.findIndex((item) => item.bleDeviceId.toLowerCase() === key);
  if (index < 0) return [...current, candidate];
  const next = [...current];
  next[index] = candidate;
  return next;
};

export const usePlugBleAddFlow = (
  dependencies: UsePlugBleAddFlowDependencies = {}
): UsePlugBleAddFlowResult => {
  const [candidates, setCandidates] = useState<PlugBleAdvertisement[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspectingDeviceId, setInspectingDeviceId] = useState<string | null>(null);
  const [verifiedCandidates, setVerifiedCandidates] = useState<
    VerifiedPlugBleCandidate[]
  >([]);
  const scannerRef = useRef<BleScanner | null>(null);
  const scanGenerationRef = useRef(0);
  const autoStart = dependencies.autoStart ?? true;
  const createScannerOverride = dependencies.createScanner;
  const inspectCandidateImpl = dependencies.inspectCandidate ?? inspectPlugBleCandidate;

  const createScanner = useCallback(
    () =>
      createScannerOverride?.() ??
      new CapacitorBleScanner({ platform: Capacitor.getPlatform() }),
    [createScannerOverride]
  );

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
    if (scannerRef.current) return;

    const generation = scanGenerationRef.current + 1;
    scanGenerationRef.current = generation;
    const scanner = createScanner();
    scannerRef.current = scanner;
    setCandidates([]);
    setVerifiedCandidates([]);
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

  const verifyCandidate = useCallback(
    async (candidate: PlugBleAdvertisement): Promise<VerifiedPlugBleCandidate | null> => {
      await stopScanNow();
      setError(null);
      setInspectingDeviceId(candidate.deviceId);
      try {
        const verified = await inspectCandidateImpl(candidate);
        setVerifiedCandidates((current) => mergeVerifiedCandidate(current, verified));
        return verified;
      } catch (caught) {
        setError(errorMessage(caught));
        return null;
      } finally {
        setInspectingDeviceId(null);
      }
    },
    [inspectCandidateImpl, stopScanNow]
  );

  useEffect(() => {
    if (autoStart) startScan();
    return () => {
      void stopScanNow();
    };
  }, [autoStart, startScan, stopScanNow]);

  return {
    candidates,
    scanning,
    error,
    inspectingDeviceId,
    verifiedCandidates,
    startScan,
    stopScan,
    verifyCandidate
  };
};
