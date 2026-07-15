import { Elysia } from 'elysia'

import { env, type SalesPlatformRegistry } from '../../../../config/env'
import { base } from '../../../../shared/plugins/base'
import { type SendToBrrrResult, sendToBrrr } from '../../services/brrr.service'
import { verifySalesSignature } from './sales.auth'
import { type SalesEventStore, SqliteSalesEventStore } from './sales.event-store'
import { mapSalesToBrrr } from './sales.mapper'
import { SalesWebhookSchema } from './sales.schemas'

const MAX_BODY_BYTES = 256 * 1024

type SendNotification = (
  payload: Parameters<typeof sendToBrrr>[0],
  logger?: Parameters<typeof sendToBrrr>[1],
) => Promise<SendToBrrrResult>

export type SalesRoutesDependencies = {
  platforms?: SalesPlatformRegistry
  eventStore?: SalesEventStore
  sendNotification?: SendNotification
}

function errorResponse(code: string, retryable: boolean) {
  return {
    ok: false,
    code,
    retryable,
  }
}

export function createSalesRoutes({
  platforms = env.SALES_WEBHOOK_PLATFORMS,
  eventStore = new SqliteSalesEventStore(env.SALES_EVENT_DB_PATH),
  sendNotification = sendToBrrr,
}: SalesRoutesDependencies = {}) {
  return new Elysia({
    name: 'SalesWebhooks',
    prefix: '/webhooks',
  })
    .use(base)
    .post(
      '/sales',
      async ({ request, set, internal_logger }) => {
        internal_logger.set('flow', 'sales-webhook-ingest')
        internal_logger.set('provider', 'sales')
        internal_logger._sample()

        const contentType = request.headers.get('content-type')?.split(';', 1)[0]
        if (contentType !== 'application/json') {
          set.status = 415
          internal_logger.set('outcome', 'rejected')
          internal_logger.set('error_code', 'UNSUPPORTED_MEDIA_TYPE')
          return errorResponse('UNSUPPORTED_MEDIA_TYPE', false)
        }

        const contentLength = Number(request.headers.get('content-length'))
        if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
          set.status = 413
          internal_logger.set('outcome', 'rejected')
          internal_logger.set('error_code', 'PAYLOAD_TOO_LARGE')
          return errorResponse('PAYLOAD_TOO_LARGE', false)
        }

        const rawBody = await request.text()
        if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
          set.status = 413
          internal_logger.set('outcome', 'rejected')
          internal_logger.set('error_code', 'PAYLOAD_TOO_LARGE')
          return errorResponse('PAYLOAD_TOO_LARGE', false)
        }

        const platformHeader = request.headers.get('x-webhook-platform')
        const signatureResult = verifySalesSignature({
          rawBody,
          platform: platformHeader,
          timestamp: request.headers.get('x-webhook-timestamp'),
          signature: request.headers.get('x-webhook-signature'),
          platforms,
        })

        if (!signatureResult.ok) {
          set.status = 401
          internal_logger.set('outcome', 'rejected')
          internal_logger.set('error_code', signatureResult.code)
          return errorResponse(signatureResult.code, signatureResult.code === 'STALE_WEBHOOK')
        }

        let untrustedBody: unknown
        try {
          untrustedBody = JSON.parse(rawBody)
        } catch {
          set.status = 422
          internal_logger.set('outcome', 'rejected')
          internal_logger.set('error_code', 'INVALID_PAYLOAD')
          return errorResponse('INVALID_PAYLOAD', false)
        }

        const parsed = SalesWebhookSchema.safeParse(untrustedBody)
        if (!parsed.success) {
          set.status = 422
          internal_logger.set('outcome', 'rejected')
          internal_logger.set('error_code', 'INVALID_PAYLOAD')
          return errorResponse('INVALID_PAYLOAD', false)
        }

        const payload = parsed.data
        const eventIdHeader = request.headers.get('x-webhook-id')
        if (
          payload.source.platform !== signatureResult.platform ||
          eventIdHeader !== payload.event_id
        ) {
          set.status = 401
          internal_logger.set('outcome', 'rejected')
          internal_logger.set('error_code', 'IDENTITY_MISMATCH')
          return errorResponse('IDENTITY_MISMATCH', false)
        }

        const transaction = payload.event === 'sale.succeeded' ? payload.sale : payload.refund
        const reference =
          payload.event === 'sale.succeeded'
            ? payload.sale.reference
            : payload.refund.original_sale.reference

        internal_logger.set('sales_event', {
          event_id: payload.event_id,
          event_type: payload.event,
          platform: payload.source.platform,
          reference,
          amount_minor: transaction.amount.value,
          currency: transaction.amount.currency,
        })

        let claim: ReturnType<SalesEventStore['claim']>
        try {
          claim = eventStore.claim(payload.event_id)
        } catch (error) {
          internal_logger.capture(error)
          set.status = 503
          internal_logger.set('outcome', 'failure')
          internal_logger.set('error_code', 'EVENT_STORE_UNAVAILABLE')
          return errorResponse('EVENT_STORE_UNAVAILABLE', true)
        }

        if (claim === 'completed') {
          set.status = 200
          internal_logger.set('outcome', 'duplicate')
          return {
            ok: true,
            duplicate: true,
            notified: false,
            event_id: payload.event_id,
          }
        }

        if (claim === 'in_progress') {
          set.status = 409
          internal_logger.set('outcome', 'conflict')
          internal_logger.set('error_code', 'EVENT_IN_PROGRESS')
          return errorResponse('EVENT_IN_PROGRESS', true)
        }

        const brrrPayload = mapSalesToBrrr(payload, signatureResult.displayName)

        try {
          const sendResult = await sendNotification(brrrPayload, internal_logger)
          eventStore.complete(payload.event_id)

          set.status = 200
          internal_logger.set('outcome', 'success')
          internal_logger.set('brrr_status', sendResult.status)
          internal_logger.set('notification_title', brrrPayload.title)

          return {
            ok: true,
            duplicate: false,
            notified: true,
            event_id: payload.event_id,
          }
        } catch (error) {
          internal_logger.capture(error)

          try {
            eventStore.release(payload.event_id)
          } catch (releaseError) {
            internal_logger.capture(releaseError)
          }

          set.status = 502
          internal_logger.set('outcome', 'failure')
          internal_logger.set('error_code', 'BRRR_DELIVERY_FAILED')
          return errorResponse('BRRR_DELIVERY_FAILED', true)
        }
      },
      {
        parse: 'none',
      },
    )
}
