import { Elysia } from 'elysia';
import { ZodError } from 'zod';
import { mapDokployToBrrr } from './dokploy.mapper';
import { normalizeDokployPayload } from './dokploy.normalizer';
import { DokployRawPayloadSchema } from './dokploy.schemas';
import { sendToBrrr } from '../../services/brrr.service';

export const dokployRoutes = new Elysia({ prefix: '/webhooks' }).post('/dokploy', async ({ body, set }) => {
  try {
    // Loose validation first to keep raw payload handling predictable.
    const rawPayload = DokployRawPayloadSchema.parse(body);
    const normalized = normalizeDokployPayload(rawPayload);
    const brrrPayload = mapDokployToBrrr(normalized);

    await sendToBrrr(brrrPayload);

    set.status = 202;
    return {
      ok: true,
      accepted: true,
      source: normalized.source,
      title: brrrPayload.title
    };
  } catch (error) {
    if (error instanceof ZodError) {
      set.status = 400;
      return {
        ok: false,
        accepted: false,
        error: `Invalid Dokploy webhook payload: ${error.issues
          .map((issue) => issue.message)
          .join(', ')}`
      };
    }

    set.status = 502;
    return {
      ok: false,
      accepted: false,
      error: error instanceof Error ? error.message : 'Unexpected error while ingesting Dokploy webhook'
    };
  }
});
