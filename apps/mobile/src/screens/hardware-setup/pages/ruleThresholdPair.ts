import type { ThresholdDirection } from '@lcl/automation-core';

export const RULE_THRESHOLD_AUTO_GAP = 1;

export const correctedOffThresholdInput = ({
  direction,
  onThresholdInput,
  offThresholdInput
}: {
  direction: ThresholdDirection;
  onThresholdInput: string;
  offThresholdInput: string;
}): string | null => {
  if (onThresholdInput.trim() === '' || offThresholdInput.trim() === '') {
    return null;
  }

  const onThreshold = Number(onThresholdInput);
  const offThreshold = Number(offThresholdInput);
  if (!Number.isFinite(onThreshold) || !Number.isFinite(offThreshold)) {
    return null;
  }

  const isValid =
    direction === 'below' ? onThreshold < offThreshold : onThreshold > offThreshold;
  if (isValid) {
    return null;
  }

  return String(
    direction === 'below'
      ? onThreshold + RULE_THRESHOLD_AUTO_GAP
      : onThreshold - RULE_THRESHOLD_AUTO_GAP
  );
};
