import type { BrrrPayload } from '../../domain/types'
import type { SalesWebhookPayload } from './sales.schemas'

export function mapSalesToBrrr(
  payload: SalesWebhookPayload,
  platformDisplayName: string,
): BrrrPayload {
  return {
    title: `${platformDisplayName} • Successful sale`,
    subtitle: `Exam: ${payload.sale.exam_type.toUpperCase()} • Quantity: ${payload.sale.quantity}`,
    message: `Amount: ${payload.sale.amount} • Provider: ${payload.sale.payment_provider} • Channel: ${payload.sale.channel}`,
    open_url: payload.dashboard_url,
    interruption_level: 'passive',
    thread_id: `sales:${payload.source.platform}`,
  }
}
