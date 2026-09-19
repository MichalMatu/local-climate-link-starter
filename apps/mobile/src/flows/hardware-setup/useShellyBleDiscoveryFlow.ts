import { useMutation } from '@tanstack/react-query';
import { generateShellyBleDiscoveryScript } from '@lcl/script-generator';
import { useRef, useState } from 'react';
import { t } from '../../app/i18n.js';
import type { BleDiscoverySnapshot } from './schemas.js';
import {
  installShellyBleDiscoveryScript,
  prepareShellyBleDiscovery,
  readShellyBleDiscoverySnapshot,
  restartShellyBleDiscoveryScan,
  stopShellyBleDiscovery
} from './shellyRequests.js';
import type { ShellyDraftDevice } from './setupDraftStore.js';

export type BleDiscoverySession = {
  shellyId: string;
  baseUrl: string;
  discoveryScriptId: number;
  automationScriptId: number | null;
  automationWasRunning: boolean;
};

type StartBleDiscoveryResult = {
  session: BleDiscoverySession;
  snapshot: BleDiscoverySnapshot;
};

const stopBleDiscoverySession = (session: BleDiscoverySession): Promise<void> =>
  stopShellyBleDiscovery(session.baseUrl, {
    discoveryScriptId: session.discoveryScriptId,
    automationScriptId: session.automationScriptId,
    restartAutomation: session.automationWasRunning
  });

export const useShellyBleDiscoveryFlow = () => {
  const [bleDiscoverySession, setBleDiscoverySession] =
    useState<BleDiscoverySession | null>(null);
  const [bleDiscoverySnapshot, setBleDiscoverySnapshot] =
    useState<BleDiscoverySnapshot | null>(null);
  const bleDiscoverySessionRef = useRef<BleDiscoverySession | null>(null);
  const cleanupAfterStartRef = useRef(false);

  const startBleDiscoveryMutation = useMutation({
    mutationFn: async (device: ShellyDraftDevice): Promise<StartBleDiscoveryResult> => {
      let preparation: Awaited<ReturnType<typeof prepareShellyBleDiscovery>> | null =
        null;
      let discoveryScriptId: number | null = null;

      try {
        preparation = await prepareShellyBleDiscovery(device.baseUrl);
        const installResult = await installShellyBleDiscoveryScript(
          device.baseUrl,
          generateShellyBleDiscoveryScript()
        );
        discoveryScriptId = installResult.scriptId;
        const session: BleDiscoverySession = {
          shellyId: device.id,
          baseUrl: device.baseUrl,
          discoveryScriptId: installResult.scriptId,
          automationScriptId: preparation.automationScriptId,
          automationWasRunning: preparation.automationWasRunning
        };
        const snapshot = await readShellyBleDiscoverySnapshot(
          device.baseUrl,
          installResult.scriptId
        );

        return { session, snapshot };
      } catch (error) {
        if (preparation) {
          try {
            await stopShellyBleDiscovery(device.baseUrl, {
              discoveryScriptId,
              automationScriptId: preparation.automationScriptId,
              restartAutomation: preparation.automationWasRunning
            });
          } catch (cleanupError) {
            const message =
              error instanceof Error
                ? error.message
                : t('hardware.flow.bleScanStartFailed');
            const cleanupMessage =
              cleanupError instanceof Error
                ? cleanupError.message
                : t('hardware.flow.bleScanCleanupFailed');
            throw new Error(`${message} ${cleanupMessage}`);
          }
        }
        throw error;
      }
    },
    onSuccess: ({ session, snapshot }) => {
      if (cleanupAfterStartRef.current) {
        cleanupAfterStartRef.current = false;
        bleDiscoverySessionRef.current = null;
        setBleDiscoverySession(null);
        setBleDiscoverySnapshot(null);
        void stopBleDiscoverySession(session).catch(() => undefined);
        return;
      }
      bleDiscoverySessionRef.current = session;
      setBleDiscoverySession(session);
      setBleDiscoverySnapshot(snapshot);
    },
    onError: () => {
      cleanupAfterStartRef.current = false;
      bleDiscoverySessionRef.current = null;
      setBleDiscoverySession(null);
      setBleDiscoverySnapshot(null);
    }
  });

  const refreshBleDiscoveryMutation = useMutation({
    mutationFn: async (session: BleDiscoverySession): Promise<BleDiscoverySnapshot> =>
      readShellyBleDiscoverySnapshot(session.baseUrl, session.discoveryScriptId),
    onSuccess: (snapshot) => setBleDiscoverySnapshot(snapshot)
  });

  const restartBleDiscoveryMutation = useMutation({
    mutationFn: async (session: BleDiscoverySession): Promise<BleDiscoverySnapshot> => {
      await restartShellyBleDiscoveryScan(session.baseUrl, session.discoveryScriptId);
      return readShellyBleDiscoverySnapshot(session.baseUrl, session.discoveryScriptId);
    },
    onSuccess: (snapshot) => setBleDiscoverySnapshot(snapshot)
  });

  const stopBleDiscoveryMutation = useMutation({
    mutationFn: stopBleDiscoverySession,
    onSuccess: () => {
      bleDiscoverySessionRef.current = null;
      setBleDiscoverySession(null);
    }
  });

  const startBleDiscovery = (device: ShellyDraftDevice) => {
    cleanupAfterStartRef.current = false;
    bleDiscoverySessionRef.current = null;
    setBleDiscoverySnapshot(null);
    setBleDiscoverySession(null);
    refreshBleDiscoveryMutation.reset();
    stopBleDiscoveryMutation.reset();
    startBleDiscoveryMutation.mutate(device);
  };

  const refreshBleDiscovery = () => {
    if (!bleDiscoverySession) {
      return;
    }
    refreshBleDiscoveryMutation.mutate(bleDiscoverySession);
  };

  const restartBleDiscovery = () => {
    if (!bleDiscoverySession || restartBleDiscoveryMutation.isPending) {
      return;
    }
    refreshBleDiscoveryMutation.reset();
    restartBleDiscoveryMutation.reset();
    restartBleDiscoveryMutation.mutate(bleDiscoverySession);
  };

  const stopBleDiscovery = () => {
    const session = bleDiscoverySessionRef.current;
    if (!session) {
      cleanupAfterStartRef.current = true;
      return;
    }
    if (stopBleDiscoveryMutation.isPending) {
      return;
    }
    stopBleDiscoveryMutation.mutate(session);
  };

  const cleanupBleDiscovery = () => {
    const session = bleDiscoverySessionRef.current;
    if (!session) {
      cleanupAfterStartRef.current = true;
      return;
    }
    if (stopBleDiscoveryMutation.isPending) {
      return;
    }
    stopBleDiscoveryMutation.mutate(session);
  };

  const resetBleDiscovery = () => {
    setBleDiscoverySnapshot(null);
    startBleDiscoveryMutation.reset();
    refreshBleDiscoveryMutation.reset();
    restartBleDiscoveryMutation.reset();
    stopBleDiscoveryMutation.reset();
  };

  return {
    bleDiscoverySession,
    bleDiscoverySnapshot,
    startBleDiscoveryMutation,
    refreshBleDiscoveryMutation,
    restartBleDiscoveryMutation,
    stopBleDiscoveryMutation,
    startBleDiscovery,
    refreshBleDiscovery,
    restartBleDiscovery,
    stopBleDiscovery,
    cleanupBleDiscovery,
    resetBleDiscovery
  };
};
