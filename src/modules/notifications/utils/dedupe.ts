import type { NotificationKind, NotificationStatus } from '../domain/types'

type CreateDokployDedupeKeyInput = {
  kind?: NotificationKind | null
  app_name?: string | null
  environment?: string | null
  source_event?: string | null
  status?: NotificationStatus | null
  occurred_at?: string | null
}

export function createDokployDedupeKey(input: CreateDokployDedupeKeyInput): string {
  const kind = input.kind ?? 'generic'
  const appName = input.app_name && input.app_name.trim().length > 0 ? input.app_name : 'default'
  const environment =
    input.environment && input.environment.trim().length > 0 ? input.environment : 'default'
  const sourceEvent =
    input.source_event && input.source_event.trim().length > 0 ? input.source_event : 'unknown'
  const status = input.status ?? 'unknown'
  const occurredAt =
    input.occurred_at && input.occurred_at.trim().length > 0 ? input.occurred_at : 'unknown'

  return `dokploy:${kind}:${appName}:${environment}:${sourceEvent}:${status}:${occurredAt}`
}
