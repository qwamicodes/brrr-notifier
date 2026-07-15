import { Elysia } from 'elysia'
import { dokployRoutes } from './modules/notifications/providers/dokploy/dokploy.routes'
import { expoWorkflowRoutes } from './modules/notifications/providers/expo-workflows/expo-workflows.routes'
import { githubActionsRoutes } from './modules/notifications/providers/github-actions/github-actions.routes'
import { createSalesRoutes } from './modules/notifications/providers/sales/sales.routes'

export const app = new Elysia()
  .get('/healthz', () => ({ ok: true }))
  .use(dokployRoutes)
  .use(githubActionsRoutes)
  .use(expoWorkflowRoutes)
  .use(createSalesRoutes())
