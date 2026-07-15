import type { BrrrPayload } from '../../domain/types'
import type { SalesWebhookPayload } from './sales.schemas'

function formatGhs(minorUnits: number): string {
  return new Intl.NumberFormat('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100)
}

function summarizeProducts(items: Array<{ product_name: string; quantity: number }>): string {
  if (items.length === 1) {
    return `${items[0].quantity}× ${items[0].product_name}`
  }

  const quantity = items.reduce((total, item) => total + item.quantity, 0)
  return `${quantity} items across ${items.length} products`
}

export function mapSalesToBrrr(
  payload: SalesWebhookPayload,
  platformDisplayName: string,
): BrrrPayload {
  const isSale = payload.event === 'sale.succeeded'
  const transaction = isSale ? payload.sale : payload.refund
  const transactionLabel = isSale ? 'Sale' : 'Refund'

  return {
    title: `${platformDisplayName} • ${isSale ? 'Successful sale' : 'Refund completed'}`,
    subtitle: summarizeProducts(transaction.items),
    message: `${transactionLabel}: GHS ${formatGhs(transaction.amount.value)} • Today: GHS ${formatGhs(payload.revenue.platform.today.net)}`,
    open_url: payload.links?.dashboard,
    interruption_level: 'passive',
    thread_id: `sales:${payload.source.platform}`,
  }
}
