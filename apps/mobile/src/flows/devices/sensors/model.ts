import { sensorProfileIdSchema, type SensorProfileId } from '@lcl/device-profiles';
import { z } from 'zod';
import type { RegistryResult } from '../../registry/result.js';

export const sensorRuntimeAddressSchema = z
  .string()
  .trim()
  .regex(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i)
  .transform((value) => value.toUpperCase());

export const createSensorId = (
  profileId: SensorProfileId,
  runtimeAddress: string
): string => `${profileId}:${runtimeAddress.trim().toUpperCase()}`;

export const savedSensorSchema = z
  .object({
    version: z.literal(1),
    id: z.string().trim().min(1),
    profileId: sensorProfileIdSchema,
    name: z.string().trim().min(1),
    runtimeAddress: sensorRuntimeAddressSchema,
    createdAtMs: z.number().int().nonnegative(),
    updatedAtMs: z.number().int().nonnegative()
  })
  .strict()
  .superRefine((sensor, context) => {
    if (
      sensor.id.toLowerCase() !==
      createSensorId(sensor.profileId, sensor.runtimeAddress).toLowerCase()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['id'],
        message: 'Sensor identity must match its profile and runtime address.'
      });
    }
  })
  .transform((sensor) => ({
    ...sensor,
    id: createSensorId(sensor.profileId, sensor.runtimeAddress)
  }));

export type SavedSensor = z.infer<typeof savedSensorSchema>;

export const createSavedSensor = ({
  profileId,
  runtimeAddress,
  name,
  nowMs
}: {
  profileId: SensorProfileId;
  runtimeAddress: string;
  name: string;
  nowMs: number;
}): RegistryResult<SavedSensor> => {
  const parsed = savedSensorSchema.safeParse({
    version: 1,
    id: createSensorId(profileId, runtimeAddress),
    profileId,
    name,
    runtimeAddress,
    createdAtMs: nowMs,
    updatedAtMs: nowMs
  });
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: { kind: 'validation-failed' } };
};
