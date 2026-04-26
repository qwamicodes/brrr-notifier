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

const JobResultInputSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value
  }

  const normalized = value.trim().toLowerCase()

  if (normalized.length === 0) {
    return 'skipped'
  }

  if (normalized === 'canceled') {
    return 'cancelled'
  }

  if (normalized === 'timed-out') {
    return 'timed_out'
  }

  if (normalized === 'action-required') {
    return 'action_required'
  }

  return normalized
}, JobResultSchema)

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
    validate: JobResultInputSchema,
  }),
})

const StageProdPayloadSchema = BaseNotifierPayloadSchema.extend({
  environment: z.union([z.literal('staging'), z.literal('production')]),
  results: z.object({
    plan: JobResultInputSchema,
    build: JobResultInputSchema,
    redeploy: JobResultInputSchema,
  }),
  changed_apps_count: z.coerce.number().int().min(0),
})

export const GithubNotifierPayloadSchema = z.discriminatedUnion('environment', [
  CiPayloadSchema,
  StageProdPayloadSchema.extend({ environment: z.literal('staging') }),
  StageProdPayloadSchema.extend({ environment: z.literal('production') }),
])
