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
      id: '0198a2ac-7a71-7000-8000-000000000001',
      exam_type: 'wassce',
      quantity: 2,
      amount: 'GHS 150.00',
      payment_provider: 'hubtel',
      channel: 'web',
    },
    dashboard_url: 'https://dashboard.example.com/purchases?q=0198a2ac-7a71-7000-8000-000000000001',
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
  test('creates a passive notification with the simplified sale fields', () => {
    const payload = SalesWebhookSchema.parse(salePayload())

    expect(mapSalesToBrrr(payload, 'Result Checker Hub')).toEqual({
      title: 'Result Checker Hub • Successful sale',
      subtitle: 'Exam: WASSCE • Quantity: 2',
      message: 'Amount: GHS 150.00 • Provider: hubtel • Channel: web',
      open_url: 'https://dashboard.example.com/purchases?q=0198a2ac-7a71-7000-8000-000000000001',
      interruption_level: 'passive',
      thread_id: 'sales:result-checker-hub',
    })
  })

  test('rejects refund events', () => {
    expect(
      SalesWebhookSchema.safeParse({
        ...salePayload(),
        event: 'refund.succeeded',
      }).success,
    ).toBe(false)
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
