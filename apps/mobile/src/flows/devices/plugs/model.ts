import type { ShellyDeviceInfo } from '@lcl/shelly-client';
import { z } from 'zod';
import type { RegistryResult } from '../../registry/result.js';

export const normalizePlugId = (deviceId: string): string =>
  deviceId.trim().toLowerCase();
export const plugIdSchema = z.string().trim().min(1).transform(normalizePlugId);

export const savedPlugSchema = z
  .object({
    version: z.literal(1),
    id: plugIdSchema,
    profileId: z.literal('shelly_plug_s_gen3'),
    name: z.string().trim().min(1),
    baseUrl: z
      .string()
      .url()
      .refine((value) => {
        const url = new URL(value);
        return (
          ['http:', 'https:'].includes(url.protocol) &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          url.pathname === '/'
        );
      })
      .transform((value) => new URL(value).origin),
    model: z.literal('S3PL-00112EU'),
    gen: z.literal(3),
    createdAtMs: z.number().int().nonnegative(),
    updatedAtMs: z.number().int().nonnegative()
  })
  .strict();

export type SavedPlug = z.infer<typeof savedPlugSchema>;

export const createSavedPlug = ({
  deviceInfo,
  name,
  baseUrl,
  nowMs
}: {
  deviceInfo: ShellyDeviceInfo;
  name: string;
  baseUrl: string;
  nowMs: number;
}): RegistryResult<SavedPlug> => {
  const parsed = savedPlugSchema.safeParse({
    version: 1,
    id: deviceInfo.id,
    profileId: 'shelly_plug_s_gen3',
    name,
    baseUrl,
    model: deviceInfo.model,
    gen: deviceInfo.gen,
    createdAtMs: nowMs,
    updatedAtMs: nowMs
  });
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: { kind: 'validation-failed' } };
};
