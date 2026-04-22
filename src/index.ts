import { app } from './app';
import { env } from './config/env';
import { getWebhookUrls, resolvePublicBaseUrl } from './modules/notifications/webhooks';

app.listen(env.PORT, () => {
  const publicBaseUrl = resolvePublicBaseUrl(env.PORT, env.PUBLIC_BASE_URL);
  const webhookUrls = getWebhookUrls(publicBaseUrl);

  if (env.LOG_LEVEL === 'debug' || env.LOG_LEVEL === 'info') {
    console.info(`[brrr-notifier] listening on port ${env.PORT} (${env.NODE_ENV})`);
    console.info('[brrr-notifier] webhook urls:');
    console.info(`- Dokploy: ${webhookUrls.dokploy}`);
  }
});
