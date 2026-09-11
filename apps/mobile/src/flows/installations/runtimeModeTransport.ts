import { RPC_METHODS } from '@lcl/shelly-client';
import { z } from 'zod';
import {
  createShellyTransport,
  unwrapShellyResult
} from '../hardware-setup/shellyRequests.js';
import type { ClimateInstalledAutomation } from './model.js';

export type InstalledAutomationRuntimeMode = 'auto' | 'manual';

export type InstalledAutomationRuntimeModeState = {
  mode: InstalledAutomationRuntimeMode;
  supported: boolean;
};

const scriptEvalResponseSchema = z.object({ result: z.string() });

const runtimeModeEvalCode: Record<InstalledAutomationRuntimeMode, string> = {
  manual: 'R.m=1;R.nh=R.fh=0;R.on=false;R.os=null;R.rs="mn";R.m',
  auto: 'R.nh=R.fh=0;R.on=false;R.os=null;R.rs="ar";R.m=0;R.m'
};

const readModeEvalCode = 'typeof R==="object"&&typeof R.m==="number"?R.m:-1';

const evaluateRuntime = async (
  installation: ClimateInstalledAutomation,
  code: string
): Promise<string> => {
  const transport = createShellyTransport(installation.shelly.baseUrl);
  const payload = unwrapShellyResult(
    await transport.call<unknown>({
      method: RPC_METHODS.ScriptEval,
      params: { id: installation.script.id, code }
    })
  );
  return scriptEvalResponseSchema.parse(payload).result;
};

export const readInstalledAutomationRuntimeMode = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationRuntimeModeState> => {
  const result = await evaluateRuntime(installation, readModeEvalCode);
  if (result === '1') {
    return { mode: 'manual', supported: true };
  }
  if (result === '0') {
    return { mode: 'auto', supported: true };
  }
  return { mode: 'auto', supported: false };
};

export const setInstalledAutomationRuntimeMode = async (
  installation: ClimateInstalledAutomation,
  mode: InstalledAutomationRuntimeMode
): Promise<void> => {
  const result = await evaluateRuntime(installation, runtimeModeEvalCode[mode]);
  const expected = mode === 'manual' ? '1' : '0';
  if (result !== expected) {
    throw new Error(`Shelly did not confirm ${mode.toUpperCase()} runtime mode.`);
  }
};
