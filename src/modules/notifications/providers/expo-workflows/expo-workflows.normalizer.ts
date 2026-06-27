import type {
  ExpoWorkflowEvent,
  ExpoWorkflowJobResult,
  ExpoWorkflowPayload,
  NormalizedExpoWorkflowInput,
} from './expo-workflows.types'

const RESULT_PRIORITY: ExpoWorkflowJobResult[] = [
  'failure',
  'timed_out',
  'action_required',
  'cancelled',
  'in_progress',
  'queued',
  'success',
  'neutral',
  'skipped',
  'unknown',
]

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function toOccurredAt(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString()
      }
    }
  }

  return new Date().toISOString()
}

function findOverallResult(results: Record<string, ExpoWorkflowJobResult>): ExpoWorkflowJobResult {
  const values = Object.values(results)

  for (const target of RESULT_PRIORITY) {
    if (values.includes(target)) {
      return target
    }
  }

  return 'unknown'
}

function inferEvent(payload: ExpoWorkflowPayload): ExpoWorkflowEvent {
  const eventHint = toOptionalString(payload.event ?? payload.type)?.toLowerCase()

  if (eventHint?.includes('submit')) {
    return 'submit'
  }

  if (eventHint?.includes('build')) {
    return 'build'
  }

  if (eventHint?.includes('workflow')) {
    return 'workflow'
  }

  if (payload.submissionDetailsPageUrl || payload.submissionInfo || payload.archiveUrl) {
    return 'submit'
  }

  if (
    payload.buildDetailsPageUrl ||
    payload.artifacts?.buildUrl ||
    payload.metadata?.buildProfile
  ) {
    return 'build'
  }

  if (
    payload.workflow ||
    payload.workflow_name ||
    payload.workflowRunId ||
    payload.workflow_run_id
  ) {
    return 'workflow'
  }

  return 'unknown'
}

function getWorkflowName(payload: ExpoWorkflowPayload, event: ExpoWorkflowEvent): string {
  const workflow =
    toOptionalString(payload.workflow) ??
    toOptionalString(payload.workflow_name) ??
    toOptionalString(payload.metadata?.workflow)

  if (workflow) {
    return workflow
  }

  switch (event) {
    case 'build':
      return 'EAS Build'
    case 'submit':
      return 'EAS Submit'
    case 'workflow':
      return 'EAS Workflow'
    default:
      return 'Expo Workflow'
  }
}

function getKnownJobs(
  payload: ExpoWorkflowPayload,
  event: ExpoWorkflowEvent,
  status: ExpoWorkflowJobResult,
): Record<string, ExpoWorkflowJobResult> {
  const jobs = payload.jobs ?? payload.results

  if (jobs && Object.keys(jobs).length > 0) {
    return jobs
  }

  if (event !== 'unknown') {
    return { [event]: status }
  }

  return {}
}

function getStatus(payload: ExpoWorkflowPayload): ExpoWorkflowJobResult {
  const explicitStatus = payload.result ?? payload.conclusion ?? payload.status

  if (explicitStatus) {
    return explicitStatus
  }

  return findOverallResult(payload.jobs ?? payload.results ?? {})
}

function getErrorMessage(payload: ExpoWorkflowPayload): string | undefined {
  return (
    toOptionalString(payload.error?.message) ??
    toOptionalString(payload.submissionInfo?.error?.message)
  )
}

export function normalizeExpoWorkflowPayload(
  payload: ExpoWorkflowPayload,
): NormalizedExpoWorkflowInput {
  const event = inferEvent(payload)
  const status = getStatus(payload)
  const jobs = getKnownJobs(payload, event, status)
  const accountName =
    toOptionalString(payload.accountName) ??
    toOptionalString(payload.account_name) ??
    toOptionalString(payload.owner) ??
    toOptionalString(payload.metadata?.username)
  const projectName =
    toOptionalString(payload.projectName) ??
    toOptionalString(payload.project_name) ??
    toOptionalString(payload.appName) ??
    toOptionalString(payload.app_name) ??
    toOptionalString(payload.metadata?.appName) ??
    'expo-project'
  const appName =
    toOptionalString(payload.appName) ??
    toOptionalString(payload.app_name) ??
    toOptionalString(payload.metadata?.appName) ??
    projectName
  const profile =
    toOptionalString(payload.profile) ??
    toOptionalString(payload.build_profile) ??
    toOptionalString(payload.buildProfile) ??
    toOptionalString(payload.metadata?.buildProfile)
  const channel =
    toOptionalString(payload.channel) ??
    toOptionalString(payload.metadata?.channel) ??
    toOptionalString(payload.metadata?.releaseChannel)
  const environment =
    toOptionalString(payload.environment) ??
    toOptionalString(payload.environment_name) ??
    profile ??
    channel
  const runId =
    toOptionalString(payload.workflowRunId) ??
    toOptionalString(payload.workflow_run_id) ??
    toOptionalString(payload.run_id) ??
    toOptionalString(payload.id) ??
    'unknown'
  const openUrl =
    toOptionalString(payload.open_url) ??
    toOptionalString(payload.dashboard_url) ??
    toOptionalString(payload.details_url) ??
    toOptionalString(payload.buildDetailsPageUrl) ??
    toOptionalString(payload.submissionDetailsPageUrl)
  const artifactUrl =
    toOptionalString(payload.artifact_url) ??
    toOptionalString(payload.build_url) ??
    toOptionalString(payload.artifacts?.buildUrl) ??
    toOptionalString(payload.archiveUrl)

  const {
    source: _source,
    id: _id,
    workflow: _workflow,
    workflow_name: _workflowName,
    workflowRunId: _workflowRunId,
    workflow_run_id: _workflowRunIdSnake,
    run_id: _runId,
    run_attempt: _runAttempt,
    event: _event,
    type: _type,
    accountName: _accountName,
    account_name: _accountNameSnake,
    owner: _owner,
    projectName: _projectName,
    project_name: _projectNameSnake,
    appName: _appName,
    app_name: _appNameSnake,
    environment: _environment,
    environment_name: _environmentName,
    platform: _platform,
    profile: _profile,
    buildProfile: _buildProfile,
    build_profile: _buildProfileSnake,
    branch: _branch,
    ref: _ref,
    actor: _actor,
    initiatingUserId: _initiatingUserId,
    initiating_user_id: _initiatingUserIdSnake,
    status: _status,
    result: _result,
    conclusion: _conclusion,
    jobs: _jobs,
    results: _results,
    buildDetailsPageUrl: _buildDetailsPageUrl,
    submissionDetailsPageUrl: _submissionDetailsPageUrl,
    details_url: _detailsUrl,
    open_url: _openUrl,
    dashboard_url: _dashboardUrl,
    artifacts: _artifacts,
    artifact_url: _artifactUrl,
    build_url: _buildUrl,
    archiveUrl: _archiveUrl,
    metadata: _metadata,
    metrics: _metrics,
    error: _error,
    submissionInfo: _submissionInfo,
    createdAt: _createdAt,
    enqueuedAt: _enqueuedAt,
    workerStartedAt: _workerStartedAt,
    completedAt: _completedAt,
    updatedAt: _updatedAt,
    expirationDate: _expirationDate,
    commit_hash: _commitHash,
    commit_message: _commitMessage,
    channel: _channel,
    runtimeVersion: _runtimeVersion,
    runtime_version: _runtimeVersionSnake,
    ...extraFields
  } = payload

  return {
    source: 'expo-workflows',
    event,
    workflow: getWorkflowName(payload, event),
    run_id: runId,
    run_attempt: toOptionalString(payload.run_attempt),
    account_name: accountName,
    project_name: projectName,
    app_name: appName,
    environment,
    platform: toOptionalString(payload.platform),
    profile,
    branch: toOptionalString(payload.branch) ?? toOptionalString(payload.ref),
    actor:
      toOptionalString(payload.actor) ??
      toOptionalString(payload.initiating_user_id) ??
      toOptionalString(payload.initiatingUserId),
    status,
    jobs,
    commit_hash:
      toOptionalString(payload.commit_hash) ?? toOptionalString(payload.metadata?.gitCommitHash),
    commit_message:
      toOptionalString(payload.commit_message) ??
      toOptionalString(payload.metadata?.gitCommitMessage),
    channel,
    runtime_version:
      toOptionalString(payload.runtime_version) ??
      toOptionalString(payload.runtimeVersion) ??
      toOptionalString(payload.metadata?.runtimeVersion),
    artifact_url: artifactUrl,
    error_message: getErrorMessage(payload),
    occurred_at: toOccurredAt(
      payload.completedAt,
      payload.updatedAt,
      payload.workerStartedAt,
      payload.enqueuedAt,
      payload.createdAt,
    ),
    open_url: openUrl,
    thread_id: `expo-workflows:${accountName ?? 'unknown'}:${projectName}:${environment ?? 'default'}`,
    extra_fields: extraFields,
  }
}
