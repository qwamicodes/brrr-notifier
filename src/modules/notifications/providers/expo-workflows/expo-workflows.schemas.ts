import { z } from 'zod'

export const ExpoWorkflowJobResultSchema = z.enum([
  'success',
  'failure',
  'cancelled',
  'skipped',
  'neutral',
  'timed_out',
  'action_required',
  'in_progress',
  'queued',
  'unknown',
])

const ExpoWorkflowJobResultInputSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value
  }

  const normalized = value.trim().toLowerCase().replaceAll('-', '_')

  if (normalized.length === 0) {
    return 'unknown'
  }

  if (normalized === 'finished' || normalized === 'completed') {
    return 'success'
  }

  if (normalized === 'errored' || normalized === 'error' || normalized === 'failed') {
    return 'failure'
  }

  if (normalized === 'canceled') {
    return 'cancelled'
  }

  if (normalized === 'timedout') {
    return 'timed_out'
  }

  if (normalized === 'actionrequired') {
    return 'action_required'
  }

  if (normalized === 'pending' || normalized === 'waiting') {
    return 'queued'
  }

  if (normalized === 'running') {
    return 'in_progress'
  }

  return normalized
}, ExpoWorkflowJobResultSchema)

const DateLikeSchema = z.union([z.string(), z.number(), z.date()])

const ExpoArtifactsSchema = z
  .object({
    buildUrl: z.string().optional(),
    logsS3KeyPrefix: z.string().optional(),
  })
  .passthrough()
  .optional()

const ExpoMetadataSchema = z
  .object({
    appName: z.string().optional(),
    username: z.string().optional(),
    workflow: z.string().optional(),
    appVersion: z.string().optional(),
    appBuildVersion: z.string().optional(),
    cliVersion: z.string().optional(),
    sdkVersion: z.string().optional(),
    buildProfile: z.string().optional(),
    distribution: z.string().optional(),
    appIdentifier: z.string().optional(),
    gitCommitHash: z.string().optional(),
    gitCommitMessage: z.string().optional(),
    runtimeVersion: z.string().optional(),
    channel: z.string().optional(),
    releaseChannel: z.string().optional(),
    message: z.string().optional(),
    runFromCI: z.boolean().optional(),
  })
  .passthrough()
  .optional()

const ExpoErrorSchema = z
  .object({
    message: z.string().optional(),
    errorCode: z.string().optional(),
  })
  .passthrough()
  .optional()

const ExpoSubmissionInfoSchema = z
  .object({
    error: ExpoErrorSchema,
    logsUrl: z.string().optional(),
  })
  .passthrough()
  .optional()

export const ExpoWorkflowPayloadSchema = z
  .object({
    source: z.enum(['expo-workflows', 'eas-workflows', 'expo', 'eas']).optional(),
    id: z.string().optional(),
    workflow: z.string().optional(),
    workflow_name: z.string().optional(),
    workflowRunId: z.string().optional(),
    workflow_run_id: z.string().optional(),
    run_id: z.string().optional(),
    run_attempt: z.coerce.string().optional(),
    event: z.string().optional(),
    type: z.string().optional(),
    accountName: z.string().optional(),
    account_name: z.string().optional(),
    owner: z.string().optional(),
    projectName: z.string().optional(),
    project_name: z.string().optional(),
    appName: z.string().optional(),
    app_name: z.string().optional(),
    environment: z.string().optional(),
    environment_name: z.string().optional(),
    platform: z.string().optional(),
    profile: z.string().optional(),
    buildProfile: z.string().optional(),
    build_profile: z.string().optional(),
    branch: z.string().optional(),
    ref: z.string().optional(),
    actor: z.string().optional(),
    initiatingUserId: z.string().optional(),
    initiating_user_id: z.string().optional(),
    status: ExpoWorkflowJobResultInputSchema.optional(),
    result: ExpoWorkflowJobResultInputSchema.optional(),
    conclusion: ExpoWorkflowJobResultInputSchema.optional(),
    jobs: z.record(ExpoWorkflowJobResultInputSchema).optional(),
    results: z.record(ExpoWorkflowJobResultInputSchema).optional(),
    buildDetailsPageUrl: z.string().optional(),
    submissionDetailsPageUrl: z.string().optional(),
    details_url: z.string().optional(),
    open_url: z.string().optional(),
    dashboard_url: z.string().optional(),
    artifacts: ExpoArtifactsSchema,
    artifact_url: z.string().optional(),
    build_url: z.string().optional(),
    archiveUrl: z.string().optional(),
    metadata: ExpoMetadataSchema,
    metrics: z.record(z.unknown()).optional(),
    error: ExpoErrorSchema,
    submissionInfo: ExpoSubmissionInfoSchema,
    createdAt: DateLikeSchema.optional(),
    enqueuedAt: DateLikeSchema.optional(),
    workerStartedAt: DateLikeSchema.optional(),
    completedAt: DateLikeSchema.optional(),
    updatedAt: DateLikeSchema.optional(),
    expirationDate: DateLikeSchema.optional(),
    commit_hash: z.string().optional(),
    commit_message: z.string().optional(),
    channel: z.string().optional(),
    runtimeVersion: z.string().optional(),
    runtime_version: z.string().optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const hasMinimumSignal =
      typeof value.id === 'string' ||
      typeof value.workflowRunId === 'string' ||
      typeof value.workflow_run_id === 'string' ||
      typeof value.run_id === 'string' ||
      typeof value.workflow === 'string' ||
      typeof value.workflow_name === 'string' ||
      typeof value.status === 'string' ||
      typeof value.result === 'string' ||
      typeof value.conclusion === 'string'

    if (!hasMinimumSignal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Expo workflow payload needs at least one of id, workflow run id, workflow, status, result, or conclusion.',
      })
    }
  })
