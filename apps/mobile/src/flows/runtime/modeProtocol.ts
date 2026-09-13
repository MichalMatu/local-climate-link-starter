import { RPC_METHODS, type ShellyRpcTransport } from '@lcl/shelly-client';
import { z } from 'zod';

export type ClimateRuntimeMode = 'auto' | 'manual';
const responseSchema = z.object({ result: z.string() });
const readCode = 'typeof R==="object"&&typeof R.m==="number"?R.m:-1';
const commands: Record<ClimateRuntimeMode, string> = {
  manual: 'R.m=1;R.nh=R.fh=0;R.on=false;R.os=null;R.rs="mn";R.m',
  auto: 'R.nh=R.fh=0;R.on=false;R.os=null;R.rs="ar";R.m=0;R.m'
};
const evaluate = async (
  transport: ShellyRpcTransport,
  scriptId: number,
  code: string
): Promise<string> => {
  const result = await transport.call<unknown>({
    method: RPC_METHODS.ScriptEval,
    params: { id: scriptId, code }
  });
  if (!result.ok) throw new Error(`Runtime mode RPC failed: ${result.error.kind}`);
  return responseSchema.parse(result.value).result;
};
export const readClimateMode = async (
  transport: ShellyRpcTransport,
  scriptId: number
): Promise<ClimateRuntimeMode | null> => {
  const result = await evaluate(transport, scriptId, readCode);
  return result === '1' ? 'manual' : result === '0' ? 'auto' : null;
};
export const writeClimateMode = async (
  transport: ShellyRpcTransport,
  scriptId: number,
  mode: ClimateRuntimeMode
): Promise<void> => {
  const result = await evaluate(transport, scriptId, commands[mode]);
  if (result !== (mode === 'manual' ? '1' : '0'))
    throw new Error(`Shelly did not confirm ${mode.toUpperCase()} runtime mode.`);
};
