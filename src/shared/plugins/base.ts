import { Elysia } from 'elysia'

import { canonicalLogger } from '../../modules/notifications/logging/wide-events.plugin'

export const base = new Elysia({ name: 'base' }).use(canonicalLogger)

export type BaseApp = typeof base
