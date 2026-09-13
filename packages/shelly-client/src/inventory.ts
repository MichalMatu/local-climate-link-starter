import { z } from 'zod';
import { RPC_METHODS, type Result, type ShellyRpcTransport } from './model.js';

const scriptsSchema = z
  .object({
    scripts: z.array(
      z.object({
        id: z.number().int().nonnegative(),
        name: z.string(),
        enable: z.boolean(),
        running: z.boolean()
      })
    )
  })
  .refine(
    ({ scripts }) => new Set(scripts.map((script) => script.id)).size === scripts.length
  );
const methodsSchema = z.object({ methods: z.array(z.string()) });
const relaySchema = z.object({ id: z.literal(0), output: z.boolean() });

export type ShellyInventoryScript = z.infer<typeof scriptsSchema>['scripts'][number];

const parseResponse = <T>(schema: z.ZodType<T>, response: Result<unknown>): Result<T> => {
  if (!response.ok) return response;
  const parsed = schema.safeParse(response.value);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : {
        ok: false,
        error: {
          kind: 'validation-failed',
          userMessageKey: 'errors.validationFailed',
          retryable: false
        }
      };
};

// Read-only, validated inventory. Missing APIs are distinguished from failed RPCs.
export class RpcShellyInventoryClient {
  constructor(private readonly transport: ShellyRpcTransport) {}

  async listScripts(): Promise<Result<{ scripts: ShellyInventoryScript[] }>> {
    return parseResponse(
      scriptsSchema,
      await this.transport.call<unknown>({ method: RPC_METHODS.ScriptList })
    );
  }

  async listMethods(): Promise<Result<{ methods: string[] }>> {
    return parseResponse(
      methodsSchema,
      await this.transport.call<unknown>({ method: RPC_METHODS.ShellyListMethods })
    );
  }

  async readRelay(): Promise<Result<{ id: 0; output: boolean }>> {
    return parseResponse(
      relaySchema,
      await this.transport.call<unknown>({
        method: RPC_METHODS.SwitchGetStatus,
        params: { id: 0 }
      })
    );
  }
}
