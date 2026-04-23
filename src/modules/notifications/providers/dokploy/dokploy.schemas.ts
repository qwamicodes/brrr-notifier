import { z } from 'zod'

const DateLikeSchema = z.union([z.string(), z.number(), z.date()])

const DokployPayloadBaseSchema = z
  .object({
    title: z.string().optional(),
    message: z.string().optional(),
    timestamp: DateLikeSchema.optional(),
    event: z.string().optional(),
    source_event: z.string().optional(),
    alertType: z.string().optional(),
    status: z.string().optional(),
    app_name: z.string().optional(),
    application_name: z.string().optional(),
    projectName: z.string().optional(),
    applicationName: z.string().optional(),
    environment: z.string().optional(),
    environment_name: z.string().optional(),
    project_name: z.string().optional(),
    application_type: z.string().optional(),
    applicationType: z.string().optional(),
    server_name: z.string().optional(),
    serverName: z.string().optional(),
    open_url: z.string().optional(),
    details_url: z.string().optional(),
    buildLink: z.string().optional(),
    errorMessage: z.string().optional(),
    backupType: z.string().optional(),
    backupSize: z.string().optional(),
    cleanupMessage: z.string().optional(),
    currentValue: z.number().optional(),
    threshold: z.number().optional(),
    databaseType: z.string().optional(),
    databaseName: z.string().optional(),
    volumeName: z.string().optional(),
    serviceType: z.string().optional(),
    date: z.string().optional(),
    domains: z.string().optional(),
    type: z.string().optional(),
    subtitle: z.string().optional(),
    sound: z.string().optional(),
    image_url: z.string().optional(),
    expiration_date: DateLikeSchema.optional(),
    filter_criteria: z.string().optional(),
    interruption_level: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .passthrough()

const BuildPayloadSchema = DokployPayloadBaseSchema.extend({
  type: z.literal('build'),
  status: z.enum(['success', 'error']).optional(),
})

const DokployBackupPayloadSchema = DokployPayloadBaseSchema.extend({
  type: z.literal('dokploy-backup'),
  status: z.enum(['success', 'error']).optional(),
})

const DokployRestartPayloadSchema = DokployPayloadBaseSchema.extend({
  type: z.literal('dokploy-restart'),
  status: z.literal('success').optional(),
})

const DockerCleanupPayloadSchema = DokployPayloadBaseSchema.extend({
  type: z.literal('docker-cleanup'),
  status: z.literal('success').optional(),
})

const ServerThresholdPayloadSchema = DokployPayloadBaseSchema.extend({
  serverName: z.string(),
  currentValue: z.number(),
  threshold: z.number(),
  alertType: z.literal('server-threshold').optional(),
})

const DatabaseBackupPayloadSchema = DokployPayloadBaseSchema.extend({
  databaseType: z.enum(['postgres', 'mysql', 'mongodb', 'mariadb', 'libsql']),
  databaseName: z.string(),
  type: z.enum(['success', 'error']).optional(),
  status: z.enum(['success', 'error']).optional(),
})

const VolumeBackupPayloadSchema = DokployPayloadBaseSchema.extend({
  volumeName: z.string(),
  serviceType: z.enum([
    'application',
    'postgres',
    'mysql',
    'mongodb',
    'mariadb',
    'redis',
    'compose',
    'libsql',
  ]),
  type: z.enum(['success', 'error']).optional(),
  status: z.enum(['success', 'error']).optional(),
})

const GenericDokployPayloadSchema = DokployPayloadBaseSchema.superRefine((value, ctx) => {
  const hasMinimumSignal =
    typeof value.title === 'string' ||
    typeof value.message === 'string' ||
    typeof value.event === 'string' ||
    typeof value.source_event === 'string' ||
    typeof value.type === 'string' ||
    typeof value.status === 'string'

  if (!hasMinimumSignal) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Dokploy payload needs at least one of title, message, event, source_event, type, or status.',
    })
  }
})

export const DokployRawPayloadSchema = z.union([
  BuildPayloadSchema,
  DokployBackupPayloadSchema,
  DokployRestartPayloadSchema,
  DockerCleanupPayloadSchema,
  ServerThresholdPayloadSchema,
  DatabaseBackupPayloadSchema,
  VolumeBackupPayloadSchema,
  GenericDokployPayloadSchema,
])
