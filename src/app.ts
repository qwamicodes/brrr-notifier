import { Elysia } from 'elysia';
import { dokployRoutes } from './modules/notifications/providers/dokploy/dokploy.routes';

export const app = new Elysia()
  .get('/healthz', () => ({ ok: true }))
  .use(dokployRoutes);
