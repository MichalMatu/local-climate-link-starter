import { z } from 'zod';

export const sensorProfileIdSchema = z.enum([
  'xiaomi_lywsd03mmc_bthome_v2',
  'tp357_custom_v1'
]);

export const outputProfileIdSchema = z.enum(['shelly_plug_s_gen3']);

export const measurementCapabilitySchema = z.enum([
  'temperatureC',
  'humidityPct',
  'batteryPct',
  'rssi'
]);

export const sensorProfileSchema = z.object({
  id: sensorProfileIdSchema,
  displayName: z.string(),
  vendor: z.string(),
  model: z.string(),
  capabilities: z.array(z.string()),
  requiredMeasurements: z.array(measurementCapabilitySchema),
  compatibilityNotes: z.array(z.string()),
  safetyNotes: z.array(z.string())
});

export const outputProfileSchema = z.object({
  id: outputProfileIdSchema,
  displayName: z.string(),
  vendor: z.string(),
  model: z.string(),
  capabilities: z.array(z.string()),
  requiredMeasurements: z.array(measurementCapabilitySchema),
  compatibilityNotes: z.array(z.string()),
  safetyNotes: z.array(z.string())
});

export type SensorProfileId = z.infer<typeof sensorProfileIdSchema>;
export type OutputProfileId = z.infer<typeof outputProfileIdSchema>;
export type MeasurementCapability = z.infer<typeof measurementCapabilitySchema>;
export type SensorProfile = z.infer<typeof sensorProfileSchema>;
export type OutputProfile = z.infer<typeof outputProfileSchema>;
