import { useEffect } from 'react';
import type { SensorSetupFlow } from './usePhoneSensorFlow.js';

type SavedSensorLiveScanFlow = Pick<
  SensorSetupFlow,
  | 'restartSavedSensorLiveScan'
  | 'savedSensorLiveScanState'
  | 'startSavedSensorLiveScan'
  | 'stopSavedSensorLiveScan'
>;

const SAVED_SENSOR_LIVE_SCAN_RETRY_MS = 1000;

type SavedSensorLiveScanLifecycleOptions = {
  flow: SavedSensorLiveScanFlow;
  enabled: boolean;
};

export const useSavedSensorLiveScanLifecycle = ({
  flow,
  enabled
}: SavedSensorLiveScanLifecycleOptions) => {
  useEffect(() => {
    if (!enabled) {
      flow.stopSavedSensorLiveScan();
      return;
    }

    flow.startSavedSensorLiveScan();
    return () => flow.stopSavedSensorLiveScan();
  }, [enabled, flow.startSavedSensorLiveScan, flow.stopSavedSensorLiveScan]);

  useEffect(() => {
    if (enabled && !flow.savedSensorLiveScanState.running) {
      const retryTimer = setTimeout(() => {
        flow.startSavedSensorLiveScan();
      }, SAVED_SENSOR_LIVE_SCAN_RETRY_MS);

      return () => clearTimeout(retryTimer);
    }

    return undefined;
  }, [enabled, flow.savedSensorLiveScanState.running, flow.startSavedSensorLiveScan]);

  useEffect(() => {
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;

    const clearResumeTimer = () => {
      if (resumeTimer !== null) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }
    };

    const scheduleResume = () => {
      if (!enabled) {
        return;
      }

      clearResumeTimer();
      resumeTimer = setTimeout(() => {
        resumeTimer = null;
        void flow.restartSavedSensorLiveScan();
      }, 250);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearResumeTimer();
        flow.stopSavedSensorLiveScan();
        return;
      }

      scheduleResume();
    };

    const handleFocus = () => {
      if (document.visibilityState !== 'hidden') {
        scheduleResume();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearResumeTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled, flow.restartSavedSensorLiveScan, flow.stopSavedSensorLiveScan]);
};
