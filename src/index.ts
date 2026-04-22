import { app } from './app'
import { env } from './config/env'
import { logger } from './lib/logger'
import { getWebhookUrls, resolvePublicBaseUrl } from './modules/notifications/webhooks'

app.listen(env.PORT, () => {
  const publicBaseUrl = resolvePublicBaseUrl(env.PORT, env.PUBLIC_BASE_URL)
  const webhookUrls = getWebhookUrls(publicBaseUrl)

  logger.info({
    event_name: 'app_startup',
    outcome: 'success',
    port: env.PORT,
    public_base_url: publicBaseUrl,
    webhook_urls: webhookUrls,
  })
})
