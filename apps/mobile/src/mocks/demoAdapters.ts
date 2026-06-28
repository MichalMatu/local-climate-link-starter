import { createDemoParsedSensors } from '@lcl/ble-core';
import { InMemoryDiagnosticLogger } from '@lcl/diagnostics';
import { FakeShellyClient } from '@lcl/shelly-client';

export const createDemoAdapters = () => ({
  sensors: createDemoParsedSensors(),
  shellyClient: new FakeShellyClient({ sleepMs: () => Promise.resolve() }),
  matterBlockedShellyClient: new FakeShellyClient({ matterEnabled: true }),
  diagnostics: new InMemoryDiagnosticLogger(80)
});
