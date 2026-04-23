import { NotificationStatusSchema } from '../../domain/schemas'
import type {
  NormalizedDokployInput,
  NotificationKind,
  NotificationMetadataValue,
  NotificationStatus,
} from '../../domain/types'
import { createDokployDedupeKey } from '../../utils/dedupe'
import type { DokployRawPayload } from './dokploy.types'
import { DokployRawPayloadSchema } from './dokploy.schemas'

const EVENT_TO_KIND: Record<string, NotificationKind> = {
  appDeploy: 'deploy',
  appBuildError: 'build',
  databaseBackup: 'backup',
  dokployBackup: 'backup',
  volumeBackup: 'backup',
  dokployRestart: 'restart',
  dockerCleanup: 'cleanup',
  serverThreshold: 'threshold',
}

const EVENT_TO_STATUS: Record<string, NotificationStatus> = {
  appBuildError: 'failure',
  serverThreshold: 'warning',
  appDeploy: 'success',
  databaseBackup: 'success',
  dokployBackup: 'success',
  volumeBackup: 'success',
  dokployRestart: 'success',
  dockerCleanup: 'success',
}

const ALLOWED_SOUNDS = new Set([
  'default',
  'system',
  'brrr',
  'bell_ringing',
  'bubble_ding',
  'bubbly_success_ding',
  'cat_meow',
  'calm1',
  'calm2',
  'cha_ching',
  'dog_barking',
  'door_bell',
  'duck_quack',
  'short_triple_blink',
  'upbeat_bells',
  'warm_soft_error',
])

const ALLOWED_INTERRUPTION_LEVELS = new Set(['passive', 'active', 'time-sensitive'])

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toOccurredAt(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString()
    }
  }

  return new Date().toISOString()
}

function toIsoDateString(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString()
    }
  }
  return null
}

function toAllowedSound(value: unknown): string | null {
  const candidate = toOptionalString(value)
  if (!candidate) {
    return null
  }
  return ALLOWED_SOUNDS.has(candidate) ? candidate : null
}

function toAllowedInterruptionLevel(
  value: unknown,
): 'passive' | 'active' | 'time-sensitive' | null {
  const candidate = toOptionalString(value)
  if (!candidate) {
    return null
  }
  return ALLOWED_INTERRUPTION_LEVELS.has(candidate)
    ? (candidate as 'passive' | 'active' | 'time-sensitive')
    : null
}

function sanitizeMetadata(value: unknown): Record<string, NotificationMetadataValue> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const entries = Object.entries(value as Record<string, unknown>)
  const safe: Record<string, NotificationMetadataValue> = {}

  for (const [key, raw] of entries) {
    if (
      typeof raw === 'string' ||
      typeof raw === 'number' ||
      typeof raw === 'boolean' ||
      raw === null
    ) {
      safe[key] = raw
    }
  }

  return Object.keys(safe).length > 0 ? safe : null
}

function normalizeStatusFromPayload(value: unknown): NotificationStatus | null {
  const candidate = toOptionalString(value)?.toLowerCase()
  if (!candidate) {
    return null
  }

  const parsed = NotificationStatusSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

export function mapDokployEventToKind(sourceEvent?: string | null): NotificationKind {
  if (!sourceEvent) {
    return 'generic'
  }

  if (
    sourceEvent === 'build' ||
    sourceEvent === 'deploy' ||
    sourceEvent === 'backup' ||
    sourceEvent === 'restart' ||
    sourceEvent === 'cleanup' ||
    sourceEvent === 'threshold'
  ) {
    return sourceEvent
  }

  return EVENT_TO_KIND[sourceEvent] ?? 'generic'
}

export function mapDokployEventToStatus(sourceEvent?: string | null): NotificationStatus {
  if (!sourceEvent) {
    return 'info'
  }

  if (sourceEvent === 'build') {
    return 'success'
  }

  return EVENT_TO_STATUS[sourceEvent] ?? 'info'
}

export function normalizeDokployPayload(payload: unknown): NormalizedDokployInput {
  const parsed = DokployRawPayloadSchema.parse(payload) as DokployRawPayload

  const appName =
    toOptionalString(parsed.app_name) ??
    toOptionalString(parsed.application_name) ??
    toOptionalString(parsed.applicationName) ??
    'dokploy-app'

  const environment =
    toOptionalString(parsed.environment) ?? toOptionalString(parsed.environment_name) ?? null

  const sourceEvent =
    toOptionalString(parsed.source_event) ??
    toOptionalString(parsed.event) ??
    toOptionalString(parsed.type) ??
    null

  const message =
    toOptionalString(parsed.message) ??
    toOptionalString(parsed.title) ??
    'Dokploy notification received.'

  const occurredAt = toOccurredAt(parsed.timestamp)
  const kind = mapDokployEventToKind(sourceEvent)
  const explicitStatus = normalizeStatusFromPayload(parsed.status)
  const status = explicitStatus ?? mapDokployEventToStatus(sourceEvent)
  const openUrl =
    toOptionalString(parsed.open_url) ??
    toOptionalString(parsed.details_url) ??
    toOptionalString(parsed.buildLink) ??
    null

  const threadId = environment ? `dokploy:${appName}:${environment}` : `dokploy:${appName}`

  const dedupeKey = createDokployDedupeKey({
    kind,
    app_name: appName,
    environment,
    source_event: sourceEvent,
    status,
    occurred_at: occurredAt,
  })

  return {
    source: 'dokploy',
    kind,
    source_event: sourceEvent,
    status,
    occurred_at: occurredAt,
    app_name: appName,
    environment,
    project_name: toOptionalString(parsed.project_name) ?? toOptionalString(parsed.projectName),
    application_type:
      toOptionalString(parsed.application_type) ?? toOptionalString(parsed.applicationType),
    server_name: toOptionalString(parsed.server_name),
    message,
    summary: toOptionalString(parsed.title),
    subtitle: toOptionalString(parsed.subtitle),
    sound: toAllowedSound(parsed.sound),
    image_url: toOptionalString(parsed.image_url),
    expiration_date: toIsoDateString(parsed.expiration_date),
    filter_criteria: toOptionalString(parsed.filter_criteria),
    interruption_level: toAllowedInterruptionLevel(parsed.interruption_level),
    open_url: openUrl,
    thread_id: threadId,
    dedupe_key: dedupeKey,
    metadata:
      sanitizeMetadata(parsed.metadata) ??
      sanitizeMetadata({
        domains: toOptionalString(parsed.domains),
        date: toOptionalString(parsed.date),
      }),
    raw: payload,
  }
}
