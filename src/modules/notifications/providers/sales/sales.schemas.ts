import { z } from 'zod'

const MoneySchema = z.object({
  value: z.number().int(),
  currency: z.literal('GHS'),
  unit: z.literal('minor'),
})

const ProductItemSchema = z.object({
  product_id: z.string().min(1).max(100),
  product_name: z.string().min(1).max(200),
  category: z.string().min(1).max(100).optional(),
  variant: z.string().min(1).max(100).optional(),
  quantity: z.number().int().positive(),
  unit_amount: z.number().int().nonnegative(),
  total_amount: z.number().int().nonnegative(),
})

const RevenuePeriodSchema = z.object({
  gross: z.number().int().nonnegative(),
  refunded: z.number().int().nonnegative(),
  net: z.number().int(),
})

const RevenueScopeSchema = z.object({
  today: RevenuePeriodSchema,
  month: RevenuePeriodSchema,
  all_time: RevenuePeriodSchema,
})

const RevenueSchema = z.object({
  currency: z.literal('GHS'),
  timezone: z.literal('Africa/Accra'),
  business_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  calculated_at: z.string().datetime(),
  platform: RevenueScopeSchema,
  business: RevenueScopeSchema,
})

const SourceSchema = z.object({
  platform: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(100),
  environment: z.string().min(1).max(50).default('production'),
})

const LinksSchema = z
  .object({
    dashboard: z.string().url().optional(),
  })
  .optional()

const MetadataSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional()

const CommonSchema = z.object({
  event_id: z.string().min(1).max(200),
  occurred_at: z.string().datetime(),
  source: SourceSchema,
  revenue: RevenueSchema,
  links: LinksSchema,
  metadata: MetadataSchema,
})

const SaleSucceededSchema = CommonSchema.extend({
  event: z.literal('sale.succeeded'),
  sale: z.object({
    id: z.string().min(1).max(200),
    reference: z.string().min(1).max(200),
    status: z.literal('succeeded'),
    items: z.array(ProductItemSchema).min(1).max(100),
    amount: MoneySchema.refine((money) => money.value > 0, {
      message: 'sale amount must be positive',
    }),
    payment: z.object({
      provider: z.string().min(1).max(100),
      method: z.string().min(1).max(100),
      transaction_id: z.string().min(1).max(200),
    }),
    channel: z.string().min(1).max(100).optional(),
  }),
})

const RefundSucceededSchema = CommonSchema.extend({
  event: z.literal('refund.succeeded'),
  refund: z.object({
    id: z.string().min(1).max(200),
    status: z.literal('succeeded'),
    amount: MoneySchema.refine((money) => money.value > 0, {
      message: 'refund amount must be positive',
    }),
    original_sale: z.object({
      id: z.string().min(1).max(200),
      reference: z.string().min(1).max(200),
    }),
    items: z.array(ProductItemSchema).min(1).max(100),
  }),
})

export const SalesWebhookSchema = z.discriminatedUnion('event', [
  SaleSucceededSchema,
  RefundSucceededSchema,
])

export type SalesWebhookPayload = z.infer<typeof SalesWebhookSchema>
export type SaleSucceededPayload = z.infer<typeof SaleSucceededSchema>
export type RefundSucceededPayload = z.infer<typeof RefundSucceededSchema>
