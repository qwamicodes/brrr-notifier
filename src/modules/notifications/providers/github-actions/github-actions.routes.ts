import { Elysia } from 'elysia'

import { base } from '../../../../shared/plugins/base'
import { sendToBrrr } from '../../services/brrr.service'
import { mapGithubActionsToBrrr } from './github-actions.mapper'
import { normalizeGithubActionsPayload } from './github-actions.normalizer'
import { GithubNotifierPayloadSchema } from './github-actions.schemas'

export const githubActionsRoutes = new Elysia({
  name: 'GithubActionsWebhooks',
  prefix: '/webhooks',
})
  .use(base)
  .post(
    '/github-actions',
    async ({ body, set, internal_logger }) => {
      internal_logger.set('flow', 'github-actions-webhook-ingest')
      internal_logger.set('provider', 'github-actions')
      internal_logger._sample()

      const normalized = normalizeGithubActionsPayload(body)
      const brrrPayload = mapGithubActionsToBrrr(normalized)

      internal_logger.set('normalized_event', {
        source: normalized.source,
        workflow: normalized.workflow,
        environment: normalized.environment,
        repository: normalized.repository,
        run_id: normalized.run_id,
        run_attempt: normalized.run_attempt,
        overall_result: normalized.overall_result,
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
      body: GithubNotifierPayloadSchema,
    },
  )
