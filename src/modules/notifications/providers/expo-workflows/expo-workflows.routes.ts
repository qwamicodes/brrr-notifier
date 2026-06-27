import { Elysia } from 'elysia'

import { base } from '../../../../shared/plugins/base'
import { sendToBrrr } from '../../services/brrr.service'
import { mapExpoWorkflowToBrrr } from './expo-workflows.mapper'
import { normalizeExpoWorkflowPayload } from './expo-workflows.normalizer'
import { ExpoWorkflowPayloadSchema } from './expo-workflows.schemas'

export const expoWorkflowRoutes = new Elysia({
  name: 'ExpoWorkflowWebhooks',
  prefix: '/webhooks',
})
  .use(base)
  .post(
    '/expo-workflows',
    async ({ body, set, internal_logger }) => {
      internal_logger.set('flow', 'expo-workflows-webhook-ingest')
      internal_logger.set('provider', 'expo-workflows')
      internal_logger._sample()

      const normalized = normalizeExpoWorkflowPayload(body)
      const brrrPayload = mapExpoWorkflowToBrrr(normalized)

      internal_logger.set('normalized_event', {
        source: normalized.source,
        event: normalized.event,
        workflow: normalized.workflow,
        project_name: normalized.project_name,
        app_name: normalized.app_name,
        environment: normalized.environment ?? 'default',
        platform: normalized.platform ?? 'unknown',
        run_id: normalized.run_id,
        status: normalized.status,
        thread_id: normalized.thread_id,
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
      body: ExpoWorkflowPayloadSchema,
    },
  )
