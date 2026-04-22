import type { NotificationStatus } from '../domain/types'

export function formatNotificationStatus(status: NotificationStatus): string {
  switch (status) {
    case 'success':
      return '✅ SUCCESS'
    case 'failure':
      return '❌ FAILED'
    case 'warning':
      return '⚠️ WARNING'
    case 'in_progress':
      return '🚧 IN PROGRESS'
    case 'cancelled':
      return '⏹️ CANCELLED'
    case 'info':
      return 'ℹ️ INFO'
    default:
      return '❔ UNKNOWN'
  }
}
