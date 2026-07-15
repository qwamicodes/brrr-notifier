import { z } from 'zod'

export const SalesWebhookSchema = z.object({
  event: z.literal('sale.succeeded'),
  event_id: z.string().startsWith('evt_'),
  occurred_at: z.string().datetime(),
  source: z.object({
    platform: z.string().min(1),
    environment: z.enum(['development', 'staging', 'production']),
  }),
  sale: z.object({
    id: z.string().uuid(),
    exam_type: z.enum(['wassce', 'bece']),
    quantity: z.number().int().positive().max(100),
    amount: z.string().regex(/^GHS [0-9]+\.[0-9]{2}$/),
    payment_provider: z.enum(['hubtel', 'checkerport', 'simulation']),
    channel: z.enum(['web', 'ussd', 'api']),
  }),
  dashboard_url: z.string().url(),
})

export type SalesWebhookPayload = z.infer<typeof SalesWebhookSchema>
