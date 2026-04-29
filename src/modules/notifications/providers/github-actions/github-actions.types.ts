import type { z } from 'zod'

import type { GithubNotifierPayloadSchema, JobResultSchema } from './github-actions.schemas'

export type JobResult = z.infer<typeof JobResultSchema>
export type GithubNotifierPayload = z.infer<typeof GithubNotifierPayloadSchema>

export type NormalizedGithubActionsInput = {
  source: 'github-actions'
  workflow: string
  event: string
  run_id: string
  run_attempt: string
  repository: string
  sha: string
  ref: string
  actor: string
  environment: string
  results: Record<string, JobResult>
  changed_apps_count?: number
  extra_fields: Record<string, unknown>
  overall_result: JobResult
  occurred_at: string
  open_url: string
  thread_id: string
}
