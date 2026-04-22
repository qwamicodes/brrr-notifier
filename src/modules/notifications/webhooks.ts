export const webhookPaths = {
  dokploy: '/webhooks/dokploy',
} as const

export type WebhookProvider = keyof typeof webhookPaths

export function resolvePublicBaseUrl(port: number, providedBaseUrl?: string): string {
  return (providedBaseUrl ?? `http://localhost:${port}`).replace(/\/$/, '')
}

export function getWebhookUrls(baseUrl: string): Record<WebhookProvider, string> {
  return {
    dokploy: `${baseUrl}${webhookPaths.dokploy}`,
  }
}
