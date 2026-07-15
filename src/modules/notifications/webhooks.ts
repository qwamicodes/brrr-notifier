export const webhookPaths = {
  dokploy: '/webhooks/dokploy',
  githubActions: '/webhooks/github-actions',
<<<<<<< Updated upstream
  expoWorkflows: '/webhooks/expo-workflows',
=======
  sales: '/webhooks/sales',
>>>>>>> Stashed changes
} as const

export type WebhookProvider = keyof typeof webhookPaths

export function resolvePublicBaseUrl(port: number, providedBaseUrl?: string): string {
  return (providedBaseUrl ?? `http://localhost:${port}`).replace(/\/$/, '')
}

export function getWebhookUrls(baseUrl: string): Record<WebhookProvider, string> {
  return {
    dokploy: `${baseUrl}${webhookPaths.dokploy}`,
    githubActions: `${baseUrl}${webhookPaths.githubActions}`,
<<<<<<< Updated upstream
    expoWorkflows: `${baseUrl}${webhookPaths.expoWorkflows}`,
=======
    sales: `${baseUrl}${webhookPaths.sales}`,
>>>>>>> Stashed changes
  }
}
