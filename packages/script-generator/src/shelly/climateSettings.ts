import { z } from 'zod';

const ruleControlMetricSchema = z.enum(['temperature', 'humidity']);
const thresholdDirectionSchema = z.enum(['below', 'above']);

export const climateSettingsSchema = z
  .object({
    rule: z.object({
      mode: z.enum(['heating', 'cooling', 'humidifying', 'dehumidifying']),
      control: z.object({
        metric: ruleControlMetricSchema,
        direction: thresholdDirectionSchema,
        onThreshold: z.number(),
        offThreshold: z.number()
      }),
      vpdAssist: z.object({
        enabled: z.boolean(),
        targetKpa: z.number().positive().max(5)
      }),
      staleTimeoutSec: z.number().int().positive(),
      minChangeMs: z.number().int().positive(),
      maxOnMs: z.number().int().positive(),
      rssiMin: z.number().int().min(-100).max(-20),
      consecutiveHits: z.number().int().min(1).max(10).default(2),
      failSafe: z.literal('off'),
      bootState: z.literal('off')
    }),
    diagnostics: z.object({
      enabled: z.boolean().default(true)
    })
  })
  .strict()
  .superRefine((config, context) => {
    const { control } = config.rule;
    const thresholdsAreInvalid =
      control.direction === 'below'
        ? control.onThreshold >= control.offThreshold
        : control.onThreshold <= control.offThreshold;

    if (thresholdsAreInvalid) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rule', 'control', 'onThreshold'],
        message:
          control.direction === 'below'
            ? 'onThreshold must be lower than offThreshold.'
            : 'onThreshold must be higher than offThreshold.'
      });
    }
  });
