import type { z } from 'zod'

import type {
  ExpoWorkflowJobResultSchema,
  ExpoWorkflowPayloadSchema,
} from './expo-workflows.schemas'

export type ExpoWorkflowJobResult = z.infer<typeof ExpoWorkflowJobResultSchema>
export type ExpoWorkflowPayload = z.infer<typeof ExpoWorkflowPayloadSchema>

export type ExpoWorkflowEvent = 'workflow' | 'build' | 'submit' | 'unknown'

export type NormalizedExpoWorkflowInput = {
  source: 'expo-workflows'
  event: ExpoWorkflowEvent
  workflow: string
  run_id: string
  run_attempt?: string
  account_name?: string
  project_name: string
  app_name: string
  environment?: string
  platform?: string
  profile?: string
  branch?: string
  actor?: string
  status: ExpoWorkflowJobResult
  jobs: Record<string, ExpoWorkflowJobResult>
  commit_hash?: string
  commit_message?: string
  channel?: string
  runtime_version?: string
  artifact_url?: string
  error_message?: string
  occurred_at: string
  open_url?: string
  thread_id: string
  extra_fields: Record<string, unknown>
}
