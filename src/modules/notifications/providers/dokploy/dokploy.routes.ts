import { Elysia } from 'elysia'

import { base } from '../../../../shared/plugins/base'
import { sendToBrrr } from '../../services/brrr.service'

import { mapDokployToBrrr } from './dokploy.mapper'
import { normalizeDokployPayload } from './dokploy.normalizer'
import { DokployRawPayloadSchema } from './dokploy.schemas'

export const dokployRoutes = new Elysia({
  name: 'Webhooks',
  prefix: '/webhooks',
})
  .use(base)
  .post(
    '/dokploy',
    async ({ body, set, internal_logger }) => {
      internal_logger.set('flow', 'dokploy-webhook-ingest')
      internal_logger.set('provider', 'dokploy')
      internal_logger._sample()

      const normalized = normalizeDokployPayload(body)
      const brrrPayload = mapDokployToBrrr(normalized)

      internal_logger.set('normalized_event', {
        source: normalized.source,
        source_event: normalized.source_event ?? 'unknown',
        kind: normalized.kind,
        status: normalized.status,
        app_name: normalized.app_name,
        environment: normalized.environment ?? 'default',
        dedupe_key: normalized.dedupe_key,
        thread_id: normalized.thread_id ?? 'unknown',
      })

      const sendResult = await sendToBrrr(brrrPayload, internal_logger)

      set.status = 202
      internal_logger.set('outcome', 'success')
      internal_logger.set('brrr_status', sendResult.status)
      internal_logger.set('notification_title', brrrPayload.title)

      return {
        ok: true,
        accepted: true,
        source: normalized.source,
        title: brrrPayload.title,
      }
    },
    {
      body: DokployRawPayloadSchema,
    },
  )
