import { z } from 'zod';

export const shellyDeviceInfoSchema = z
  .object({
    model: z.string(),
    gen: z.number(),
    firmwareId: z.string().optional(),
    fw_id: z.string().optional(),
    ver: z.string().optional(),
    matter: z.boolean().optional()
  })
  .transform((deviceInfo) => ({
    model: deviceInfo.model,
    gen: deviceInfo.gen,
    firmwareId: deviceInfo.firmwareId ?? deviceInfo.fw_id ?? deviceInfo.ver,
    matterEnabled: deviceInfo.matter
  }));

export const scriptCreateResponseSchema = z.object({
  id: z.number()
});

export const scriptListResponseSchema = z.object({
  scripts: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      enable: z.boolean().default(false),
      running: z.boolean().default(false)
    })
  )
});

export const scriptCodeResponseSchema = z.object({
  data: z.string().default(''),
  left: z.number().int().min(0).default(0)
});

export const scriptStatusSchema = z.object({
  id: z.number().optional(),
  running: z.boolean().optional(),
  mem_used: z.number().optional(),
  mem_free: z.number().optional(),
  errors: z.array(z.unknown()).optional(),
  error: z.unknown().optional()
});

export const switchStatusSchema = z.object({
  id: z.number().optional(),
  output: z.boolean(),
  apower: z.number().optional(),
  voltage: z.number().optional(),
  current: z.number().optional(),
  aenergy: z
    .object({
      total: z.number().optional()
    })
    .passthrough()
    .optional(),
  temperature: z
    .object({
      tC: z.number().optional()
    })
    .passthrough()
    .optional()
});

export const wifiStatusSchema = z
  .object({
    rssi: z.number().optional()
  })
  .passthrough();

export const sysStatusSchema = z
  .object({
    time: z.string().nullable().optional(),
    unixtime: z.number().nullable().optional(),
    uptime: z.number().optional(),
    last_sync_ts: z.number().nullable().optional()
  })
  .passthrough();
