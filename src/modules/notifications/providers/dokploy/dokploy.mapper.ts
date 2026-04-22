import type { BrrrPayload, NormalizedDokployInput } from '../../domain/types'
import { formatNotificationTitle } from '../../utils/title'

export function mapDokployToBrrr(input: NormalizedDokployInput): BrrrPayload {
  return {
    title: formatNotificationTitle({
      app_name: input.app_name,
      environment: input.environment,
      status: input.status,
    }),
    subtitle: input.subtitle ?? input.summary ?? undefined,
    message: input.message,
    sound: input.sound ?? undefined,
    open_url: input.open_url ?? undefined,
    image_url: input.image_url ?? undefined,
    expiration_date: input.expiration_date ?? undefined,
    filter_criteria: input.filter_criteria ?? undefined,
    interruption_level: input.interruption_level ?? undefined,
    thread_id: input.thread_id ?? undefined,
  }
}
