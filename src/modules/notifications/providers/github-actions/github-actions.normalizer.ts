import type {
  GithubNotifierPayload,
  JobResult,
  NormalizedGithubActionsInput,
} from './github-actions.types'

const RESULT_PRIORITY: JobResult[] = [
  'failure',
  'timed_out',
  'action_required',
  'cancelled',
  'success',
  'neutral',
  'skipped',
]

function findOverallResult(results: Record<string, JobResult>): JobResult {
  const values = Object.values(results)

  for (const target of RESULT_PRIORITY) {
    if (values.includes(target)) {
      return target
    }
  }

  return 'neutral'
}

function getChangedAppsCount(payload: GithubNotifierPayload): number | undefined {
  if (typeof payload.changed_apps_count === 'number') {
    return payload.changed_apps_count
  }

  if (
    typeof payload.changes === 'object' &&
    payload.changes !== null &&
    'count' in payload.changes
  ) {
    const count = Number(payload.changes.count)

    if (Number.isInteger(count) && count >= 0) {
      return count
    }
  }

  return undefined
}

export function normalizeGithubActionsPayload(
  payload: GithubNotifierPayload,
): NormalizedGithubActionsInput {
  const results = payload.results as Record<string, JobResult>
  const overallResult = findOverallResult(results)
  const openUrl = `https://github.com/${payload.repository}/actions/runs/${payload.run_id}/attempts/${payload.run_attempt}`
  const changedAppsCount = getChangedAppsCount(payload)
  const {
    source: _source,
    workflow: _workflow,
    event: _event,
    run_id: _runId,
    run_attempt: _runAttempt,
    repository: _repository,
    sha: _sha,
    ref: _ref,
    actor: _actor,
    environment: _environment,
    results: _results,
    changed_apps_count: _changedAppsCount,
    ...extraFields
  } = payload

  return {
    source: 'github-actions',
    workflow: payload.workflow,
    event: payload.event,
    run_id: payload.run_id,
    run_attempt: payload.run_attempt,
    repository: payload.repository,
    sha: payload.sha,
    ref: payload.ref,
    actor: payload.actor,
    environment: payload.environment,
    results,
    changed_apps_count: payload.environment === 'ci' ? undefined : changedAppsCount,
    extra_fields: extraFields,
    overall_result: overallResult,
    occurred_at: new Date().toISOString(),
    open_url: openUrl,
    thread_id: `github-actions:${payload.repository}:${payload.workflow}:${payload.environment}`,
  }
}
