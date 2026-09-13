import { normalizeRuleSchedule } from '@lcl/automation-core';
import { climateSettingsSchema } from '@lcl/script-generator';
import { z } from 'zod';
import { plugIdSchema } from '../devices/plugs/model.js';

const clockTimePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const weekdaySchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6)
]);

export const ruleTimeWindowSchema = z
  .object({
    days: z
      .array(weekdaySchema)
      .min(1)
      .max(7)
      .refine(
        (days) => new Set(days).size === days.length,
        'Window days must be unique.'
      ),
    start: z.string().regex(clockTimePattern),
    end: z.string().regex(clockTimePattern)
  })
  .strict()
  .refine((window) => window.start !== window.end, {
    message: 'Window start and end times must be different.',
    path: ['end']
  });

export const ruleScheduleSchema = z
  .object({ windows: z.array(ruleTimeWindowSchema).min(1).max(16) })
  .strict()
  .transform((schedule) => normalizeRuleSchedule(schedule));

const baseRuleSchema = z.object({
  version: z.literal(1),
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  plugId: plugIdSchema,
  relayId: z.literal(0),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative()
});

const safetyTestSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('pending') }).strict(),
  z
    .object({ status: z.literal('failed'), failedAtMs: z.number().int().nonnegative() })
    .strict(),
  z
    .object({
      status: z.literal('verified'),
      verifiedAtMs: z.number().int().nonnegative()
    })
    .strict()
]);

const timeDeploymentPairSchema = z
  .object({
    windowIndex: z.number().int().nonnegative(),
    onJobId: z.number().int().nonnegative(),
    offJobId: z.number().int().nonnegative()
  })
  .strict()
  .refine((pair) => pair.onJobId !== pair.offJobId, {
    message: 'ON and OFF schedule job ids must differ.'
  });

export const climateRuleSchema = baseRuleSchema
  .extend({
    kind: z.literal('climate'),
    sensorId: z.string().trim().min(1),
    config: climateSettingsSchema,
    schedule: ruleScheduleSchema.nullable(),
    deployment: z
      .object({
        scriptId: z.number().int().nonnegative(),
        scriptHash: z.string().trim().min(1),
        safetyTest: safetyTestSchema
      })
      .strict()
      .nullable()
  })
  .strict();

export const timeRuleSchema = baseRuleSchema
  .extend({
    kind: z.literal('time'),
    config: z.object({ schedule: ruleScheduleSchema }).strict(),
    deployment: z
      .object({ pairs: z.array(timeDeploymentPairSchema).min(1).max(16) })
      .strict()
      .nullable()
  })
  .strict()
  .superRefine((rule, context) => {
    if (!rule.deployment) return;
    const expectedCount = rule.config.schedule.windows.length;
    const pairs = rule.deployment.pairs;
    if (pairs.length !== expectedCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deployment', 'pairs'],
        message: 'Deployment must contain one schedule pair per rule window.'
      });
    }
    const indexes = pairs.map((pair) => pair.windowIndex);
    if (
      new Set(indexes).size !== indexes.length ||
      indexes.some((index) => index >= expectedCount) ||
      !Array.from({ length: expectedCount }, (_, index) => index).every((index) =>
        indexes.includes(index)
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deployment', 'pairs'],
        message: 'Deployment window indexes must exactly cover the configured schedule.'
      });
    }
    const jobIds = pairs.flatMap((pair) => [pair.onJobId, pair.offJobId]);
    if (new Set(jobIds).size !== jobIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deployment', 'pairs'],
        message: 'Deployment schedule job ids must be unique.'
      });
    }
  });

export const automationRuleSchema = z.union([climateRuleSchema, timeRuleSchema]);
export type RuleTimeWindow = z.input<typeof ruleTimeWindowSchema>;
export type RuleSchedule = z.output<typeof ruleScheduleSchema>;
export type ClimateRule = z.infer<typeof climateRuleSchema>;
export type TimeRule = z.infer<typeof timeRuleSchema>;
export type AutomationRule = z.infer<typeof automationRuleSchema>;
