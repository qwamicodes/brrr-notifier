import type { NotificationStatus } from '../../domain/types'

export type DokployRawPayload = {
  title?: unknown
  message?: unknown
  timestamp?: unknown
  event?: unknown
  source_event?: unknown
  status?: unknown
  app_name?: unknown
  application_name?: unknown
  projectName?: unknown
  applicationName?: unknown
  environment?: unknown
  environment_name?: unknown
  project_name?: unknown
  application_type?: unknown
  applicationType?: unknown
  server_name?: unknown
  open_url?: unknown
  details_url?: unknown
  buildLink?: unknown
  date?: unknown
  domains?: unknown
  type?: unknown
  subtitle?: unknown
  sound?: unknown
  image_url?: unknown
  expiration_date?: unknown
  filter_criteria?: unknown
  interruption_level?: unknown
  metadata?: unknown
  [key: string]: unknown
}

export type DokployStatusCandidate = NotificationStatus | null
