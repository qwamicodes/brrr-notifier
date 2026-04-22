export interface SamplingInput {
  status: number
  duration_ms: number
  should_sample?: boolean
}

export interface SamplingResult {
  should_emit: boolean
  sample_reason: 'error' | 'slow_request' | 'sampled' | 'dropped' | 'vital_operation_sampled'
}

export interface CanonicalLog {
  request_id: string
  method: string
  path: string
  timestamp: string
  status?: number
  duration_ms?: number
  should_sample?: boolean
  sample_reason: SamplingResult['sample_reason']
  wideEvents: Record<string, unknown>
  error?: {
    message: string
    name: string
    stack?: string
  }
}

export interface RequestLogger {
  set: (key: string, value: unknown) => void
  capture: (err: unknown) => void
  _emit: (status: number) => void
  _sample: () => void
}
