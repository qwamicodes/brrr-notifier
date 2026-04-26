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

export function normalizeGithubActionsPayload(
  payload: GithubNotifierPayload,
): NormalizedGithubActionsInput {
  const results = payload.results as Record<string, JobResult>
  const overallResult = findOverallResult(results)
  const openUrl = `https://github.com/${payload.repository}/actions/runs/${payload.run_id}/attempts/${payload.run_attempt}`

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
    changed_apps_count: payload.environment === 'ci' ? undefined : payload.changed_apps_count,
    overall_result: overallResult,
    occurred_at: new Date().toISOString(),
    open_url: openUrl,
    thread_id: `github-actions:${payload.repository}:${payload.workflow}:${payload.environment}`,
  }
}
