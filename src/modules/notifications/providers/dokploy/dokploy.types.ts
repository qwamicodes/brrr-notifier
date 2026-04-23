import type { z } from 'zod'

import type { DokployRawPayloadSchema } from './dokploy.schemas'

export type DokployRawPayload = z.infer<typeof DokployRawPayloadSchema>
