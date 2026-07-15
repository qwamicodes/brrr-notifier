import { createHmac, timingSafeEqual } from 'node:crypto'

import type { SalesPlatformRegistry } from '../../../../config/env'

const SIGNATURE_PATTERN = /^sha256=([a-f0-9]{64})$/

export type VerifySalesSignatureInput = {
  rawBody: string
  platform: string | null
  timestamp: string | null
  signature: string | null
  platforms: SalesPlatformRegistry
  now?: number
}

export type SalesSignatureResult =
  | { ok: true; platform: string; displayName: string }
  | { ok: false; code: 'UNAUTHORIZED' | 'STALE_WEBHOOK' }

function matchesSignature(message: string, signature: Buffer, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(message).digest()
  return signature.length === expected.length && timingSafeEqual(signature, expected)
}

export function verifySalesSignature({
  rawBody,
  platform,
  timestamp,
  signature,
  platforms,
  now = Date.now(),
}: VerifySalesSignatureInput): SalesSignatureResult {
  if (!platform || !timestamp || !signature) {
    return { ok: false, code: 'UNAUTHORIZED' }
  }

  const platformConfig = platforms[platform]
  const signatureMatch = SIGNATURE_PATTERN.exec(signature)
  const timestampSeconds = Number(timestamp)

  if (!platformConfig || !signatureMatch || !Number.isInteger(timestampSeconds)) {
    return { ok: false, code: 'UNAUTHORIZED' }
  }

  if (Math.abs(Math.floor(now / 1000) - timestampSeconds) > 5 * 60) {
    return { ok: false, code: 'STALE_WEBHOOK' }
  }

  const message = `${timestamp}.${rawBody}`
  const received = Buffer.from(signatureMatch[1], 'hex')
  const secrets = [platformConfig.currentSecret, platformConfig.previousSecret].filter(
    (secret): secret is string => Boolean(secret),
  )

  if (!secrets.some((secret) => matchesSignature(message, received, secret))) {
    return { ok: false, code: 'UNAUTHORIZED' }
  }

  return {
    ok: true,
    platform,
    displayName: platformConfig.displayName,
  }
}
