import moment from 'moment'

import type { BrrrPayload } from '../../domain/types'
import type { JobResult, NormalizedGithubActionsInput } from './github-actions.types'

function toTitleWords(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function formatResult(result: JobResult): string {
  switch (result) {
    case 'success':
      return 'Success'
    case 'failure':
      return 'Failed'
    case 'cancelled':
      return 'Cancelled'
    case 'skipped':
      return 'Skipped'
    case 'neutral':
      return 'Neutral'
    case 'timed_out':
      return 'Timed Out'
    case 'action_required':
      return 'Action Required'
    default:
      return 'Unknown'
  }
}

function formatEnvironment(environment: NormalizedGithubActionsInput['environment']): string {
  if (environment === 'ci') {
    return 'CI'
  }

  return toTitleWords(environment)
}

function formatExtraValue(value: unknown): string {
  if (value === null) {
    return 'null'
  }

  if (typeof value === 'string') {
    return value.length > 0 ? value : '(empty)'
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  const serialized = JSON.stringify(value)

  return serialized ?? String(value)
}

export function mapGithubActionsToBrrr(input: NormalizedGithubActionsInput): BrrrPayload {
  const statusLabel = formatResult(input.overall_result)
  const environmentLabel = formatEnvironment(input.environment)
  const runDate = moment(input.occurred_at).isValid()
    ? moment(input.occurred_at).format('LL')
    : input.occurred_at

  const resultLines = Object.entries(input.results).map(
    ([jobName, result]) => `- ${toTitleWords(jobName)}: ${formatResult(result)}`,
  )
  const extraFieldLines = Object.entries(input.extra_fields).map(
    ([fieldName, value]) => `- ${toTitleWords(fieldName)}: ${formatExtraValue(value)}`,
  )

  const message = [
    `Workflow: ${input.workflow}`,
    `Repository: ${input.repository}`,
    `Environment: ${environmentLabel}`,
    `Event: ${input.event}`,
    `Actor: ${input.actor}`,
    `Ref: ${input.ref}`,
    `SHA: ${input.sha}`,
    `Run: #${input.run_id} (attempt ${input.run_attempt})`,
    `Date: ${runDate}`,
    'Results:',
    ...resultLines,
    typeof input.changed_apps_count === 'number'
      ? `Changed Apps: ${input.changed_apps_count}`
      : null,
    extraFieldLines.length > 0 ? 'Additional Payload:' : null,
    ...extraFieldLines,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    title: `${input.repository} - ${environmentLabel} - ${statusLabel}`,
    subtitle: `${input.workflow} (${statusLabel})`,
    message,
    open_url: input.open_url,
    thread_id: input.thread_id,
  }
}
