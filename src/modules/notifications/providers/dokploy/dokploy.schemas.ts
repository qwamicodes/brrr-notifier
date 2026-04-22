import { z } from 'zod';

export const DokployRawPayloadSchema = z
  .object({
    title: z.string().optional(),
    message: z.string().optional(),
    timestamp: z.union([z.string(), z.number(), z.date()]).optional(),
    event: z.string().optional(),
    source_event: z.string().optional(),
    status: z.string().optional(),
    app_name: z.string().optional(),
    application_name: z.string().optional(),
    environment: z.string().optional(),
    environment_name: z.string().optional(),
    project_name: z.string().optional(),
    application_type: z.string().optional(),
    server_name: z.string().optional(),
    open_url: z.string().optional(),
    details_url: z.string().optional(),
    subtitle: z.string().optional(),
    sound: z.string().optional(),
    image_url: z.string().optional(),
    expiration_date: z.union([z.string(), z.number(), z.date()]).optional(),
    filter_criteria: z.string().optional(),
    interruption_level: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
  })
  .passthrough();
