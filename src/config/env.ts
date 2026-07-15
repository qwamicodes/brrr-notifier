import { config as loadEnv } from 'dotenv'
import { z } from 'zod'

loadEnv()

const SalesPlatformConfigSchema = z.object({
  displayName: z.string().min(1),
  currentSecret: z.string().min(32),
  previousSecret: z.string().min(32).optional(),
})

export const SalesPlatformRegistrySchema = z.record(SalesPlatformConfigSchema)
export type SalesPlatformRegistry = z.infer<typeof SalesPlatformRegistrySchema>

function parseSalesPlatforms(value: string | undefined): unknown {
  if (!value) {
    return {}
  }

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4888),
  PUBLIC_BASE_URL: z.string().url().optional(),
  BRRR_BASE_URL: z.string().url().default('https://api.brrr.now'),
  BRRR_SECRET: z.string().min(1, 'BRRR_SECRET is required'),
  SALES_WEBHOOK_PLATFORMS: z.preprocess(
    (value) => parseSalesPlatforms(typeof value === 'string' ? value : undefined),
    SalesPlatformRegistrySchema,
  ),
  SALES_EVENT_DB_PATH: z.string().min(1).default('./data/sales-events.sqlite'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_VERSION: z.string().default('unknown'),
  GIT_COMMIT_SHA: z.string().default('unknown'),
  REGION: z.string().default('unknown'),
  INSTANCE_ID: z.string().default('unknown'),
})

const parsed = EnvSchema.safeParse(process.env)

if (!parsed.success) {
  const formatted = parsed.error.issues.map((issue) => issue.message).join(', ')
  throw new Error(`Invalid environment configuration: ${formatted}`)
}

export const env = parsed.data
