import { Capacitor } from '@capacitor/core';
import { useMutation } from '@tanstack/react-query';
import {
  CapacitorBleGattClient,
  CapacitorBleScanner,
  setPvvxDeviceTime,
  type BleScanner
} from '@lcl/ble-core';
import type { SensorProfileId } from '@lcl/device-profiles';
import { useCallback, useMemo, useRef, useState } from 'react';
import { t } from '../../app/i18n.js';
import {
  mergeBleDiscoveryCandidate,
  scanPhoneBleSensors,
  type PhoneBleScanOutcome
} from './phoneBleScan.js';
import type { BleDiscoveryCandidate } from './schemas.js';
import {
  sensorReadingFromCandidate,
  useHardwareSetupReadingsStore
} from './sensorReadingsStore.js';
import { normalizeRuntimeAddress } from './validation.js';

type SavedSensorLiveScanState = {
  running: boolean;
  error: string | null;
  updatedAtMs: number | null;
};

type SensorRuntimeSource = 'phone-scan' | 'shelly-scan';

export type SensorRuntimeDevice = {
  id: string;
  name: string;
  runtimeAddress: string;
  profileId: SensorProfileId;
};

type PvvxTimeMutationResult = {
  device: SensorRuntimeDevice;
  acknowledged: boolean;
};

const PHONE_GATT_RADIO_SETTLE_MS = 1200;

const waitForPhoneBleRadioIdle = (): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, PHONE_GATT_RADIO_SETTLE_MS);
  });

const savedSensorLiveScanError = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string'
      ? error.message
      : t('hardware.sensor.phoneBleGenericFailed');

export const usePhoneSensorFlow = (
  sensorDevices: readonly SensorRuntimeDevice[],
  upsertSensorDevice: (device: SensorRuntimeDevice) => void
) => {
  const appendSensorReading = useHardwareSetupReadingsStore(
    (state) => state.appendSensorReading
  );
  const [phoneBleScanCandidates, setPhoneBleScanCandidates] = useState<
    BleDiscoveryCandidate[]
  >([]);
  const phoneBleScannerRef = useRef<BleScanner | null>(null);
  const savedSensorLiveScannerRef = useRef<BleScanner | null>(null);
  const [savedSensorLiveScanState, setSavedSensorLiveScanState] =
    useState<SavedSensorLiveScanState>({
      running: false,
      error: null,
      updatedAtMs: null
    });
  const savedSensorRuntimeAddresses = useMemo(
    () => new Set(sensorDevices.map((device) => device.runtimeAddress.toUpperCase())),
    [sensorDevices]
  );

  const stopSavedSensorLiveScanNow = useCallback(async (): Promise<void> => {
    const scanner = savedSensorLiveScannerRef.current;
    savedSensorLiveScannerRef.current = null;
    if (!scanner) {
      return;
    }
    setSavedSensorLiveScanState((current) => ({
      ...current,
      running: false
    }));
    await scanner.stopScan().catch(() => undefined);
  }, []);

  const stopSavedSensorLiveScan = useCallback(() => {
    void stopSavedSensorLiveScanNow();
  }, [stopSavedSensorLiveScanNow]);

  const startSavedSensorLiveScan = useCallback(() => {
    if (
      Capacitor.getPlatform() === 'web' ||
      savedSensorLiveScannerRef.current ||
      phoneBleScannerRef.current ||
      savedSensorRuntimeAddresses.size === 0
    ) {
      return;
    }

    const scanner = new CapacitorBleScanner({ platform: Capacitor.getPlatform() });
    savedSensorLiveScannerRef.current = scanner;
    setSavedSensorLiveScanState((current) => ({
      ...current,
      running: true,
      error: null
    }));

    void scanPhoneBleSensors({
      scanner,
      timeoutMs: 0,
      onCandidate: (candidate) => {
        const runtimeAddress = normalizeRuntimeAddress(candidate.runtimeAddress);
        if (!savedSensorRuntimeAddresses.has(runtimeAddress.toUpperCase())) {
          return;
        }

        appendSensorReading(
          sensorReadingFromCandidate({ ...candidate, runtimeAddress }, 'phone-scan')
        );
        setSavedSensorLiveScanState({
          running: true,
          error: null,
          updatedAtMs: Date.now()
        });
      }
    })
      .catch((error: unknown) => {
        if (savedSensorLiveScannerRef.current !== scanner) {
          return;
        }
        setSavedSensorLiveScanState((current) => ({
          ...current,
          running: false,
          error: savedSensorLiveScanError(error)
        }));
      })
      .finally(() => {
        if (savedSensorLiveScannerRef.current === scanner) {
          savedSensorLiveScannerRef.current = null;
          setSavedSensorLiveScanState((current) => ({
            ...current,
            running: false
          }));
        }
      });
  }, [appendSensorReading, savedSensorRuntimeAddresses]);

  const restartSavedSensorLiveScan = useCallback(async (): Promise<void> => {
    await stopSavedSensorLiveScanNow();
    startSavedSensorLiveScan();
  }, [startSavedSensorLiveScan, stopSavedSensorLiveScanNow]);

  const preparePhoneGattConnection = useCallback(async (): Promise<void> => {
    const hadSavedSensorScan = savedSensorLiveScannerRef.current !== null;
    const phoneScanner = phoneBleScannerRef.current;
    phoneBleScannerRef.current = null;

    await stopSavedSensorLiveScanNow();
    await phoneScanner?.stopScan().catch(() => undefined);

    if (hadSavedSensorScan || phoneScanner) {
      await waitForPhoneBleRadioIdle();
    }
  }, [stopSavedSensorLiveScanNow]);

  const upsertPhoneBleScanCandidate = (candidate: BleDiscoveryCandidate) => {
    appendSensorReading(sensorReadingFromCandidate(candidate, 'phone-scan'));
    setPhoneBleScanCandidates((current) =>
      mergeBleDiscoveryCandidate(current, candidate)
    );
  };

  const phoneBleScanMutation = useMutation({
    mutationFn: async (): Promise<PhoneBleScanOutcome> => {
      await stopSavedSensorLiveScanNow();
      const scanner = new CapacitorBleScanner({ platform: Capacitor.getPlatform() });
      phoneBleScannerRef.current = scanner;
      setPhoneBleScanCandidates([]);

      try {
        return await scanPhoneBleSensors({
          scanner,
          onCandidate: upsertPhoneBleScanCandidate
        });
      } finally {
        if (phoneBleScannerRef.current === scanner) {
          phoneBleScannerRef.current = null;
        }
      }
    },
    onSuccess: (outcome) => setPhoneBleScanCandidates(outcome.candidates)
  });

  const startPhoneBleScan = () => {
    phoneBleScanMutation.reset();
    phoneBleScanMutation.mutate();
  };

  const stopPhoneBleScan = () => {
    void phoneBleScannerRef.current?.stopScan();
  };

  const resetPhoneBleScan = () => {
    stopPhoneBleScan();
    setPhoneBleScanCandidates([]);
    phoneBleScanMutation.reset();
  };

  const addDiscoveredSensor = (
    candidate: BleDiscoveryCandidate,
    source: SensorRuntimeSource = 'phone-scan'
  ) => {
    const runtimeAddress = normalizeRuntimeAddress(candidate.runtimeAddress);
    const name = t('hardware.flow.sensorDefaultName', {
      suffix: runtimeAddress.split(':').slice(-2).join(':')
    });
    appendSensorReading(
      sensorReadingFromCandidate({ ...candidate, runtimeAddress }, source)
    );
    upsertSensorDevice({
      id: runtimeAddress,
      name,
      runtimeAddress,
      profileId: candidate.profileId
    });
  };

  const setPvvxTimeMutation = useMutation({
    mutationFn: async (device: SensorRuntimeDevice): Promise<PvvxTimeMutationResult> => {
      if (device.profileId !== 'xiaomi_lywsd03mmc_bthome_v2') {
        throw new Error(t('hardware.sensor.pvvxOnlyXiaomi'));
      }
      if (Capacitor.getPlatform() === 'web') {
        throw new Error(t('hardware.sensor.pvvxMobileOnly'));
      }

      await preparePhoneGattConnection();
      const gatt = new CapacitorBleGattClient();
      const status = await setPvvxDeviceTime({
        gatt,
        deviceId: device.runtimeAddress
      });
      return { device, acknowledged: status !== null };
    }
  });

  return {
    phoneBleScanCandidates,
    phoneBleScanMutation,
    startPhoneBleScan,
    stopPhoneBleScan,
    resetPhoneBleScan,
    savedSensorLiveScanState,
    startSavedSensorLiveScan,
    restartSavedSensorLiveScan,
    stopSavedSensorLiveScan,
    addDiscoveredSensor,
    setPvvxTimeMutation
  };
};
