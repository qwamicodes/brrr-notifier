import { z } from 'zod'

export const JobResultSchema = z.enum([
  'success',
  'failure',
  'cancelled',
  'skipped',
  'neutral',
  'timed_out',
  'action_required',
])

const BaseNotifierPayloadSchema = z.object({
  source: z.literal('github-actions'),
  workflow: z.string().min(1),
  event: z.string().min(1),
  run_id: z.string().min(1),
  run_attempt: z.string().min(1),
  repository: z.string().min(1),
  sha: z.string().min(7),
  ref: z.string().min(1),
  actor: z.string().min(1),
})

const CiPayloadSchema = BaseNotifierPayloadSchema.extend({
  environment: z.literal('ci'),
  results: z.object({
    validate: JobResultSchema,
  }),
})

const StageProdPayloadSchema = BaseNotifierPayloadSchema.extend({
  environment: z.union([z.literal('staging'), z.literal('production')]),
  results: z.object({
    plan: JobResultSchema,
    build: JobResultSchema,
    redeploy: JobResultSchema,
  }),
  changed_apps_count: z.coerce.number().int().min(0),
})

export const GithubNotifierPayloadSchema = z.discriminatedUnion('environment', [
  CiPayloadSchema,
  StageProdPayloadSchema.extend({ environment: z.literal('staging') }),
  StageProdPayloadSchema.extend({ environment: z.literal('production') }),
])
