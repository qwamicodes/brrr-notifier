import { describe, expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'

import type { BrrrPayload } from '../../domain/types'
import { verifySalesSignature } from './sales.auth'
import { SqliteSalesEventStore } from './sales.event-store'
import { mapSalesToBrrr } from './sales.mapper'
import { SalesWebhookSchema } from './sales.schemas'

const PLATFORM = 'result-checker-hub'
const SECRET = 'test-secret-that-is-at-least-32-characters'
const platforms = {
  [PLATFORM]: {
    displayName: 'Result Checker Hub',
    currentSecret: SECRET,
  },
}

function revenuePeriod(gross: number, refunded: number) {
  return {
    gross,
    refunded,
    net: gross - refunded,
  }
}

function salePayload(eventId = 'evt_sale_123') {
  return {
    event: 'sale.succeeded',
    event_id: eventId,
    occurred_at: '2026-07-15T14:30:00.000Z',
    source: {
      platform: PLATFORM,
      environment: 'production',
    },
    sale: {
      id: 'sale_12345',
      reference: 'CHK-2026-000123',
      status: 'succeeded',
      items: [
        {
          product_id: 'wassce-checker',
          product_name: 'WASSCE Result Checker',
          category: 'result-checker',
          variant: '2026',
          quantity: 2,
          unit_amount: 7_500,
          total_amount: 15_000,
        },
      ],
      amount: {
        value: 15_000,
        currency: 'GHS',
        unit: 'minor',
      },
      payment: {
        provider: 'paystack',
        method: 'mobile_money',
        transaction_id: 'txn_98765',
      },
      channel: 'web',
    },
    revenue: {
      currency: 'GHS',
      timezone: 'Africa/Accra',
      business_date: '2026-07-15',
      calculated_at: '2026-07-15T14:30:00.000Z',
      platform: {
        today: revenuePeriod(425_000, 0),
        month: revenuePeriod(6_250_000, 0),
        all_time: revenuePeriod(28_450_000, 0),
      },
      business: {
        today: revenuePeriod(810_000, 0),
        month: revenuePeriod(12_400_000, 0),
        all_time: revenuePeriod(59_750_000, 0),
      },
    },
    links: {
      dashboard: 'https://checkers.example.com/admin/sales/sale_12345',
    },
  }
}

function refundPayload() {
  const sale = salePayload('evt_refund_456')
  const { sale: originalSale, ...common } = sale

  return {
    ...common,
    event: 'refund.succeeded',
    refund: {
      id: 'refund_456',
      status: 'succeeded',
      amount: {
        value: 7_500,
        currency: 'GHS',
        unit: 'minor',
      },
      original_sale: {
        id: originalSale.id,
        reference: originalSale.reference,
      },
      items: [{ ...originalSale.items[0], quantity: 1, total_amount: 7_500 }],
    },
    revenue: {
      ...sale.revenue,
      platform: {
        ...sale.revenue.platform,
        today: revenuePeriod(425_000, 7_500),
      },
    },
  }
}

function sign(rawBody: string, timestamp: string, secret = SECRET): string {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
  return `sha256=${digest}`
}

function signedRequest(payload: ReturnType<typeof salePayload>, secret = SECRET): Request {
  const rawBody = JSON.stringify(payload)
  const timestamp = String(Math.floor(Date.now() / 1000))

  return new Request('http://localhost/webhooks/sales', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-webhook-id': payload.event_id,
      'x-webhook-platform': PLATFORM,
      'x-webhook-timestamp': timestamp,
      'x-webhook-signature': sign(rawBody, timestamp, secret),
    },
    body: rawBody,
  })
}

describe('sales webhook authentication', () => {
  test('accepts a current platform secret', () => {
    const rawBody = JSON.stringify(salePayload())
    const now = Date.now()
    const timestamp = String(Math.floor(now / 1000))

    expect(
      verifySalesSignature({
        rawBody,
        platform: PLATFORM,
        timestamp,
        signature: sign(rawBody, timestamp),
        platforms,
        now,
      }),
    ).toEqual({ ok: true, platform: PLATFORM, displayName: 'Result Checker Hub' })
  })

  test('accepts the previous secret during rotation', () => {
    const previousSecret = 'previous-secret-that-is-at-least-32-characters'
    const rawBody = JSON.stringify(salePayload())
    const now = Date.now()
    const timestamp = String(Math.floor(now / 1000))

    expect(
      verifySalesSignature({
        rawBody,
        platform: PLATFORM,
        timestamp,
        signature: sign(rawBody, timestamp, previousSecret),
        platforms: {
          [PLATFORM]: {
            ...platforms[PLATFORM],
            previousSecret,
          },
        },
        now,
      }),
    ).toEqual({ ok: true, platform: PLATFORM, displayName: 'Result Checker Hub' })
  })

  test('rejects stale signatures', () => {
    const rawBody = JSON.stringify(salePayload())
    const now = Date.now()
    const timestamp = String(Math.floor(now / 1000) - 301)

    expect(
      verifySalesSignature({
        rawBody,
        platform: PLATFORM,
        timestamp,
        signature: sign(rawBody, timestamp),
        platforms,
        now,
      }),
    ).toEqual({ ok: false, code: 'STALE_WEBHOOK' })
  })
})

describe('sales notification mapping', () => {
  test('creates a passive notification with sale and today revenue', () => {
    const payload = SalesWebhookSchema.parse(salePayload())

    expect(mapSalesToBrrr(payload, 'Result Checker Hub')).toEqual({
      title: 'Result Checker Hub • Successful sale',
      subtitle: '2× WASSCE Result Checker',
      message: 'Sale: GHS 150.00 • Today: GHS 4,250.00',
      open_url: 'https://checkers.example.com/admin/sales/sale_12345',
      interruption_level: 'passive',
      thread_id: 'sales:result-checker-hub',
    })
  })

  test('creates a passive partial refund notification', () => {
    const payload = SalesWebhookSchema.parse(refundPayload())

    expect(mapSalesToBrrr(payload, 'Result Checker Hub')).toEqual({
      title: 'Result Checker Hub • Refund completed',
      subtitle: '1× WASSCE Result Checker',
      message: 'Refund: GHS 75.00 • Today: GHS 4,175.00',
      open_url: 'https://checkers.example.com/admin/sales/sale_12345',
      interruption_level: 'passive',
      thread_id: 'sales:result-checker-hub',
    })
  })
})

describe('sales event store', () => {
  test('claims, completes, and deduplicates events', () => {
    const store = new SqliteSalesEventStore(':memory:')

    expect(store.claim('evt_1')).toBe('claimed')
    expect(store.claim('evt_1')).toBe('in_progress')
    store.complete('evt_1')
    expect(store.claim('evt_1')).toBe('completed')
  })

  test('allows a failed delivery to be retried', () => {
    const store = new SqliteSalesEventStore(':memory:')

    expect(store.claim('evt_2')).toBe('claimed')
    store.release('evt_2')
    expect(store.claim('evt_2')).toBe('claimed')
  })
})

describe('POST /webhooks/sales', () => {
  test('sends once and acknowledges completed duplicates', async () => {
    process.env.BRRR_SECRET ??= 'test-brrr-secret'
    const { createSalesRoutes } = await import('./sales.routes')
    const sent: BrrrPayload[] = []
    const app = createSalesRoutes({
      platforms,
      eventStore: new SqliteSalesEventStore(':memory:'),
      sendNotification: async (payload) => {
        sent.push(payload)
        return { ok: true, status: 202 }
      },
    })
    const payload = salePayload()

    const first = await app.handle(signedRequest(payload))
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({
      ok: true,
      duplicate: false,
      notified: true,
      event_id: payload.event_id,
    })

    const duplicate = await app.handle(signedRequest(payload))
    expect(duplicate.status).toBe(200)
    expect(await duplicate.json()).toEqual({
      ok: true,
      duplicate: true,
      notified: false,
      event_id: payload.event_id,
    })
    expect(sent).toHaveLength(1)
    expect(sent[0].interruption_level).toBe('passive')
    expect(sent[0].sound).toBeUndefined()
  })

  test('releases failed deliveries so the sender can retry', async () => {
    process.env.BRRR_SECRET ??= 'test-brrr-secret'
    const { createSalesRoutes } = await import('./sales.routes')
    let attempts = 0
    const app = createSalesRoutes({
      platforms,
      eventStore: new SqliteSalesEventStore(':memory:'),
      sendNotification: async () => {
        attempts += 1
        if (attempts === 1) {
          throw new Error('temporary brrr failure')
        }
        return { ok: true, status: 202 }
      },
    })
    const payload = salePayload('evt_retry')

    const failed = await app.handle(signedRequest(payload))
    expect(failed.status).toBe(502)
    expect(await failed.json()).toEqual({
      ok: false,
      code: 'BRRR_DELIVERY_FAILED',
      retryable: true,
    })

    const retried = await app.handle(signedRequest(payload))
    expect(retried.status).toBe(200)
    expect(attempts).toBe(2)
  })

  test('rejects invalid signatures before sending', async () => {
    process.env.BRRR_SECRET ??= 'test-brrr-secret'
    const { createSalesRoutes } = await import('./sales.routes')
    let sent = false
    const app = createSalesRoutes({
      platforms,
      eventStore: new SqliteSalesEventStore(':memory:'),
      sendNotification: async () => {
        sent = true
        return { ok: true, status: 202 }
      },
    })

    const response = await app.handle(signedRequest(salePayload(), `${SECRET}-wrong`))
    expect(response.status).toBe(401)
    expect(sent).toBe(false)
  })
})
