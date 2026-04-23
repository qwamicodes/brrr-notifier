import moment from 'moment'
import type { BrrrPayload, NormalizedDokployInput } from '../../domain/types'

function toTitleWords(value: string): string {
  return value
    .split(/[\s_-]+/)
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

function toStatusLabel(status: NormalizedDokployInput['status']): string {
  switch (status) {
    case 'success':
      return 'Success'
    case 'failure':
      return 'Failed'
    case 'warning':
      return 'Warning'
    case 'in_progress':
      return 'In Progress'
    case 'cancelled':
      return 'Cancelled'
    case 'info':
      return 'Info'
    default:
      return 'Unknown'
  }
}

export function mapDokployToBrrr(input: NormalizedDokployInput): BrrrPayload {
  const projectLabel = toTitleWords(input.project_name ?? 'dokploy')
  const appLabel = toTitleWords(input.app_name)
  const statusLabel = toStatusLabel(input.status)
  const formattedDate = moment(input.occurred_at).isValid()
    ? moment(input.occurred_at).format('LL')
    : input.occurred_at

  const messageDetails = [
    `Message: ${input.message}`,
    `Date: ${formattedDate}`,
    `Type: ${toTitleWords(input.kind)}`,
    `Status: ${statusLabel}`,
    `Project: ${projectLabel}`,
    `Application: ${appLabel}`,
    input.application_type ? `Application Type: ${toTitleWords(input.application_type)}` : null,
    input.environment ? `Environment: ${input.environment}` : null,
    input.metadata?.domains ? `Domains: ${String(input.metadata.domains)}` : null,
    input.open_url ? `Build Link: ${input.open_url}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    title: `${projectLabel} - ${appLabel} - ${statusLabel}`,
    subtitle: input.message,
    message: messageDetails,
    sound: input.sound ?? undefined,
    open_url: input.open_url ?? undefined,
    image_url: input.image_url ?? undefined,
    expiration_date: input.expiration_date ?? undefined,
    filter_criteria: input.filter_criteria ?? undefined,
    interruption_level: input.interruption_level ?? undefined,
    thread_id: input.thread_id ?? undefined,
  }
}
