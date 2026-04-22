export type NotificationSource = 'dokploy'

export type NotificationStatus =
  | 'success'
  | 'failure'
  | 'warning'
  | 'in_progress'
  | 'cancelled'
  | 'info'
  | 'unknown'

export type NotificationKind =
  | 'build'
  | 'deploy'
  | 'backup'
  | 'restart'
  | 'cleanup'
  | 'threshold'
  | 'generic'

export type NotificationMetadataValue = string | number | boolean | null

export type NormalizedDokployInput = {
  source: NotificationSource
  kind: NotificationKind
  source_event?: string | null
  status: NotificationStatus
  occurred_at: string

  app_name: string
  environment?: string | null
  project_name?: string | null

  application_type?: string | null
  server_name?: string | null

  message: string
  summary?: string | null
  subtitle?: string | null
  sound?: string | null
  image_url?: string | null
  expiration_date?: string | null
  filter_criteria?: string | null
  interruption_level?: 'passive' | 'active' | 'time-sensitive' | null

  open_url?: string | null
  thread_id?: string | null
  dedupe_key: string

  metadata?: Record<string, NotificationMetadataValue> | null
  raw?: unknown
}

export type BrrrPayload = {
  title: string
  subtitle?: string
  message: string
  sound?: string
  open_url?: string
  image_url?: string
  expiration_date?: string
  filter_criteria?: string
  interruption_level?: 'passive' | 'active' | 'time-sensitive'
  thread_id?: string
}
