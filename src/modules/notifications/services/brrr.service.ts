import { env } from '../../../config/env'
import type { RequestLogger } from '../logging/logger.types'
import { BrrrPayloadSchema } from '../domain/schemas'
import type { BrrrPayload } from '../domain/types'

export type SendToBrrrResult = {
  ok: boolean
  status: number
}

export async function sendToBrrr(
  payload: BrrrPayload,
  internal_logger?: RequestLogger,
): Promise<SendToBrrrResult> {
  const startedAt = performance.now()
  const parsedPayload = BrrrPayloadSchema.parse(payload)
  const url = `${env.BRRR_BASE_URL.replace(/\/$/, '')}/v1/send`
  internal_logger?.set('operation', 'send_to_brrr')
  internal_logger?.set('endpoint', '/v1/send')
  internal_logger?.set('thread_id', parsedPayload.thread_id ?? 'none')
  internal_logger?.set('notification_title', parsedPayload.title)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.BRRR_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parsedPayload),
    })
    internal_logger?.set('brrr_response_status', response.status)

    if (!response.ok) {
      const bodyText = await response.text()
      internal_logger?.set('brrr_response_body', bodyText || 'empty response body')
      throw new Error(
        `brrr send failed with status ${response.status}: ${bodyText || 'empty response body'}`,
      )
    }

    return {
      ok: true,
      status: response.status,
    }
  } catch (error) {
    internal_logger?.capture(error)
    throw error
  } finally {
    internal_logger?.set('brrr_send_duration_ms', Math.round(performance.now() - startedAt))
  }
}
