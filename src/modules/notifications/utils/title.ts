import type { NotificationStatus } from '../domain/types'
import { formatNotificationStatus } from './status'

type FormatNotificationTitleInput = {
  app_name: string
  environment?: string | null
  status: NotificationStatus
}

export function formatNotificationTitle(input: FormatNotificationTitleInput): string {
  const envPart =
    input.environment && input.environment.trim().length > 0 ? input.environment : 'default'
  return `${input.app_name} • ${envPart} • ${formatNotificationStatus(input.status)}`
}
