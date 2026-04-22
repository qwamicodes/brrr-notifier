import pino from 'pino'
import { env } from '../config/env'

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: 'brrr-notifier',
    env: env.NODE_ENV,
    app_version: env.APP_VERSION,
    git_commit_sha: env.GIT_COMMIT_SHA,
    region: env.REGION,
    instance_id: env.INSTANCE_ID,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})
