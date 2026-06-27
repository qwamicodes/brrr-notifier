import moment from 'moment'

import type { BrrrPayload } from '../../domain/types'
import type {
  ExpoWorkflowEvent,
  ExpoWorkflowJobResult,
  NormalizedExpoWorkflowInput,
} from './expo-workflows.types'

function toTitleWords(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => {
      const upper = segment.toUpperCase()
      if (upper.length <= 4) {
        return upper
      }
      return upper.charAt(0) + upper.slice(1).toLowerCase()
    })
    .join(' ')
}

function formatResult(result: ExpoWorkflowJobResult): string {
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
    case 'in_progress':
      return 'In Progress'
    case 'queued':
      return 'Queued'
    default:
      return 'Unknown'
  }
}

function formatEvent(event: ExpoWorkflowEvent): string {
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

export function mapExpoWorkflowToBrrr(input: NormalizedExpoWorkflowInput): BrrrPayload {
  const statusLabel = formatResult(input.status)
  const eventLabel = formatEvent(input.event)
  const environmentLabel = input.environment ? toTitleWords(input.environment) : 'Default'
  const projectLabel = toTitleWords(input.project_name)
  const runDate = moment(input.occurred_at).isValid()
    ? moment(input.occurred_at).format('LL')
    : input.occurred_at
  const jobLines = Object.entries(input.jobs).map(
    ([jobName, result]) => `- ${toTitleWords(jobName)}: ${formatResult(result)}`,
  )
  const extraFieldLines = Object.entries(input.extra_fields).map(
    ([fieldName, value]) => `- ${toTitleWords(fieldName)}: ${formatExtraValue(value)}`,
  )

  const message = [
    `Workflow: ${input.workflow}`,
    `Event: ${eventLabel}`,
    `Project: ${input.project_name}`,
    input.account_name ? `Account: ${input.account_name}` : null,
    `Application: ${input.app_name}`,
    `Environment: ${environmentLabel}`,
    input.platform ? `Platform: ${toTitleWords(input.platform)}` : null,
    input.profile ? `Profile: ${input.profile}` : null,
    input.actor ? `Actor: ${input.actor}` : null,
    input.branch ? `Ref: ${input.branch}` : null,
    input.commit_hash ? `Commit: ${input.commit_hash}` : null,
    input.commit_message ? `Commit Message: ${input.commit_message}` : null,
    `Status: ${statusLabel}`,
    `Run: ${input.run_id}${input.run_attempt ? ` (attempt ${input.run_attempt})` : ''}`,
    `Date: ${runDate}`,
    input.channel ? `Channel: ${input.channel}` : null,
    input.runtime_version ? `Runtime Version: ${input.runtime_version}` : null,
    input.artifact_url ? `Artifact: ${input.artifact_url}` : null,
    input.error_message ? `Error: ${input.error_message}` : null,
    jobLines.length > 0 ? 'Jobs:' : null,
    ...jobLines,
    extraFieldLines.length > 0 ? 'Additional Payload:' : null,
    ...extraFieldLines,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    title: `${projectLabel} - ${environmentLabel} - ${statusLabel}`,
    subtitle: `${input.workflow} (${statusLabel})`,
    message,
    open_url: input.open_url,
    thread_id: input.thread_id,
  }
}
