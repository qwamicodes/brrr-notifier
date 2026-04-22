import { z } from 'zod';

export const NotificationStatusSchema = z.enum([
  'success',
  'failure',
  'warning',
  'in_progress',
  'cancelled',
  'info',
  'unknown'
]);

export const NotificationKindSchema = z.enum([
  'build',
  'deploy',
  'backup',
  'restart',
  'cleanup',
  'threshold',
  'generic'
]);

export const NormalizedDokployInputSchema = z.object({
  source: z.literal('dokploy'),
  kind: NotificationKindSchema,
  source_event: z.string().nullable().optional(),
  status: NotificationStatusSchema,
  occurred_at: z.string(),
  app_name: z.string().min(1),
  environment: z.string().nullable().optional(),
  project_name: z.string().nullable().optional(),
  application_type: z.string().nullable().optional(),
  server_name: z.string().nullable().optional(),
  message: z.string().min(1),
  summary: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  sound: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  expiration_date: z.string().nullable().optional(),
  filter_criteria: z.string().nullable().optional(),
  interruption_level: z.enum(['passive', 'active', 'time-sensitive']).nullable().optional(),
  open_url: z.string().nullable().optional(),
  thread_id: z.string().nullable().optional(),
  dedupe_key: z.string().min(1),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).nullable().optional(),
  raw: z.unknown().optional()
});

export const BrrrPayloadSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1).optional(),
  message: z.string().min(1),
  sound: z
    .enum([
      'default',
      'system',
      'brrr',
      'bell_ringing',
      'bubble_ding',
      'bubbly_success_ding',
      'cat_meow',
      'calm1',
      'calm2',
      'cha_ching',
      'dog_barking',
      'door_bell',
      'duck_quack',
      'short_triple_blink',
      'upbeat_bells',
      'warm_soft_error'
    ])
    .optional(),
  open_url: z.string().url().optional(),
  image_url: z.string().url().optional(),
  expiration_date: z.string().datetime().optional(),
  filter_criteria: z.string().min(1).optional(),
  interruption_level: z.enum(['passive', 'active', 'time-sensitive']).optional(),
  thread_id: z.string().min(1).optional()
});
