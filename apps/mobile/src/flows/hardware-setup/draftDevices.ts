import type { SensorProfileId } from '@lcl/device-profiles';

export type ShellyDraftDevice = {
  id: string;
  name: string;
  baseUrl: string;
  scriptIdInput: string;
};

export type SensorDraftDevice = {
  id: string;
  name: string;
  runtimeAddress: string;
  profileId: SensorProfileId;
};
