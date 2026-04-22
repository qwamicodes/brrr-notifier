import { Elysia } from 'elysia'

import { env } from '../../../config/env'
import { logger as log } from '../../../lib/logger'
import type { CanonicalLog, RequestLogger, SamplingInput, SamplingResult } from './logger.types'

const SAMPLING_CONFIG = {
  SLOW_REQUEST_THRESHOLD_MS: 500,
  SUCCESS_SAMPLE_RATE: 0.1,
} as const

function evaluateSampling({
  status,
  duration_ms,
  should_sample = false,
}: SamplingInput): SamplingResult {
  if (status >= 400) {
    return { should_emit: true, sample_reason: 'error' }
  }

  if (duration_ms >= SAMPLING_CONFIG.SLOW_REQUEST_THRESHOLD_MS) {
    return { should_emit: true, sample_reason: 'slow_request' }
  }

  if (should_sample) {
    return { should_emit: true, sample_reason: 'vital_operation_sampled' }
  }

  if (Math.random() < SAMPLING_CONFIG.SUCCESS_SAMPLE_RATE) {
    return { should_emit: true, sample_reason: 'sampled' }
  }

  return { should_emit: false, sample_reason: 'dropped' }
}

function resolveRequestId(request: Request): string {
  return request.headers.get('x-request-id') ?? crypto.randomUUID()
}

function createLogger(request: Request, request_id: string): RequestLogger {
  const startedAt = performance.now()

  const canonicalLog: CanonicalLog = {
    request_id,
    should_sample: false,
    method: request.method,
    path: new URL(request.url).pathname,
    timestamp: new Date().toISOString(),
    sample_reason: 'dropped',
    wideEvents: {
      service: 'brrr-notifier',
      node_env: env.NODE_ENV,
      app_version: env.APP_VERSION,
      git_commit_sha: env.GIT_COMMIT_SHA,
      region: env.REGION,
      instance_id: env.INSTANCE_ID,
    },
  }

  return {
    set(key, value) {
      if (key in canonicalLog.wideEvents) {
        const oldValue = canonicalLog.wideEvents[key]

        if (typeof oldValue === 'object' && oldValue && Array.isArray(oldValue)) {
          if (typeof value === 'object' && value && Array.isArray(value)) {
            canonicalLog.wideEvents[key] = oldValue.concat(value)
            return
          }
        }

        if (typeof oldValue === 'object' && oldValue && typeof value === 'object' && value) {
          canonicalLog.wideEvents[key] = { ...oldValue, ...value }
          return
        }
      }

      canonicalLog.wideEvents[key] = value
    },

    capture(err) {
      if (err instanceof Error) {
        canonicalLog.error = {
          name: err.name,
          message: err.message,
          stack: env.NODE_ENV !== 'production' ? err.stack : undefined,
        }
        return
      }

      canonicalLog.error = { name: 'UnknownError', message: String(err) }
    },

    _emit(status) {
      const duration_ms = Math.round(performance.now() - startedAt)
      const { should_emit, sample_reason } = evaluateSampling({
        status,
        duration_ms,
        should_sample: canonicalLog.should_sample,
      })

      if (!should_emit) {
        return
      }

      const finalLog: CanonicalLog = {
        ...canonicalLog,
        status,
        duration_ms,
        sample_reason,
      }

      if (sample_reason === 'error') {
        log.error(finalLog)
        return
      }

      log.info(finalLog)
    },

    _sample() {
      canonicalLog.should_sample = true
    },
  }
}

export const canonicalLogger = new Elysia({ name: 'canonical-logger' })
  .derive({ as: 'global' }, ({ request }) => {
    const request_id = resolveRequestId(request)

    return {
      internal_logger: createLogger(request, request_id),
    }
  })
  .onAfterHandle({ as: 'global' }, ({ internal_logger, set }) => {
    const status = typeof set.status === 'number' ? set.status : 200
    internal_logger._emit(status)
  })
  .onError({ as: 'global' }, ({ internal_logger, error, set }) => {
    internal_logger?.capture(error)
    const status = typeof set.status === 'number' ? set.status : 500
    internal_logger?._emit(status)
  })

export const wideEventsPlugin = canonicalLogger
