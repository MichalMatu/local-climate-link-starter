import { z } from 'zod';
import { RPC_METHODS, type Result, type ShellyRpcTransport } from './model.js';

const scheduleCallSchema = z.object({
  method: z.string().trim().min(1),
  params: z.record(z.string(), z.unknown()).optional()
});

const scheduleJobConfigSchema = z.object({
  enable: z.boolean().default(true),
  timespec: z.string().trim().min(1),
  calls: z.array(scheduleCallSchema).min(1).max(5)
});

const scheduleJobSchema = scheduleJobConfigSchema.extend({
  id: z.number().int().nonnegative()
});

const scheduleListResponseSchema = z.object({
  jobs: z.array(scheduleJobSchema),
  rev: z.number().int().nonnegative()
});

const scheduleCreateResponseSchema = z.object({
  id: z.number().int().nonnegative(),
  rev: z.number().int().nonnegative()
});

const scheduleMutationResponseSchema = z.object({
  rev: z.number().int().nonnegative()
});

export type ShellyScheduleCall = z.infer<typeof scheduleCallSchema>;
export type ShellyScheduleJobConfig = z.input<typeof scheduleJobConfigSchema>;
export type ShellyScheduleJob = z.infer<typeof scheduleJobSchema>;
export type ShellyScheduleList = z.infer<typeof scheduleListResponseSchema>;
export type ShellyScheduleCreateResult = z.infer<typeof scheduleCreateResponseSchema>;
export type ShellyScheduleMutationResult = z.infer<typeof scheduleMutationResponseSchema>;

const validationError = (message: string) => ({
  kind: 'validation-failed' as const,
  userMessageKey: 'errors.validationFailed',
  technicalMessage: message,
  retryable: false
});

const validateScheduleId = (id: number): Result<number> =>
  Number.isInteger(id) && id >= 0
    ? { ok: true, value: id }
    : { ok: false, error: validationError(`Invalid Shelly schedule id: ${id}.`) };

export class RpcShellyScheduleClient {
  constructor(private readonly transport: ShellyRpcTransport) {}

  async list(): Promise<Result<ShellyScheduleList>> {
    const response = await this.transport.call<unknown>({
      method: RPC_METHODS.ScheduleList
    });
    if (!response.ok) {
      return response;
    }

    const parsed = scheduleListResponseSchema.safeParse(response.value);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, error: validationError(parsed.error.message) };
  }

  async create(
    job: ShellyScheduleJobConfig
  ): Promise<Result<ShellyScheduleCreateResult>> {
    const parsedJob = scheduleJobConfigSchema.safeParse(job);
    if (!parsedJob.success) {
      return { ok: false, error: validationError(parsedJob.error.message) };
    }

    const response = await this.transport.call<unknown>({
      method: RPC_METHODS.ScheduleCreate,
      params: parsedJob.data
    });
    if (!response.ok) {
      return response;
    }

    const parsedResponse = scheduleCreateResponseSchema.safeParse(response.value);
    return parsedResponse.success
      ? { ok: true, value: parsedResponse.data }
      : { ok: false, error: validationError(parsedResponse.error.message) };
  }

  async update(
    id: number,
    patch: Partial<ShellyScheduleJobConfig>
  ): Promise<Result<ShellyScheduleMutationResult>> {
    const parsedId = validateScheduleId(id);
    if (!parsedId.ok) {
      return parsedId;
    }

    const parsedPatch = scheduleJobConfigSchema.partial().safeParse(patch);
    if (!parsedPatch.success || Object.keys(parsedPatch.data).length === 0) {
      return {
        ok: false,
        error: validationError(
          parsedPatch.success
            ? 'Schedule.Update requires at least one field.'
            : parsedPatch.error.message
        )
      };
    }

    const response = await this.transport.call<unknown>({
      method: RPC_METHODS.ScheduleUpdate,
      params: { id: parsedId.value, ...parsedPatch.data }
    });
    if (!response.ok) {
      return response;
    }

    const parsedResponse = scheduleMutationResponseSchema.safeParse(response.value);
    return parsedResponse.success
      ? { ok: true, value: parsedResponse.data }
      : { ok: false, error: validationError(parsedResponse.error.message) };
  }

  async delete(id: number): Promise<Result<ShellyScheduleMutationResult>> {
    const parsedId = validateScheduleId(id);
    if (!parsedId.ok) {
      return parsedId;
    }

    const response = await this.transport.call<unknown>({
      method: RPC_METHODS.ScheduleDelete,
      params: { id: parsedId.value }
    });
    if (!response.ok) {
      return response;
    }

    const parsedResponse = scheduleMutationResponseSchema.safeParse(response.value);
    return parsedResponse.success
      ? { ok: true, value: parsedResponse.data }
      : { ok: false, error: validationError(parsedResponse.error.message) };
  }
}
